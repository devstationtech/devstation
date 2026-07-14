import { join } from "node:path";
import type { Provisioning } from "@server/cluster/domain/ports/outbound/executions/proxmox/provisioning/provisioning.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { Node } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import type { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import type { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Step } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { ProviderNotConnected } from "@server/cluster/domain/exceptions/provider-not-connected.ts";
import type {
  ProvisioningCli,
  RunEvent,
} from "@server/cluster/outbound/executions/proxmox/provisioning/runner.ts";
import type { SshCli } from "@server/shared/ssh/outbound/cli.ts";
import type { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";
import type { WorkingDir } from "@server/cluster/outbound/executions/proxmox/provisioning/working-dir.ts";
import type { CapacityPreflight } from "@server/cluster/outbound/executions/proxmox/capacity-preflight.ts";
import type { CredentialResolver } from "@server/cluster/outbound/credential-resolver.ts";
import type { TfvarsBuilder } from "@server/cluster/outbound/executions/proxmox/provisioning/tfvars-builder.ts";
import type { ProvisioningEnv } from "@server/cluster/outbound/executions/proxmox/provisioning/provisioning-env.ts";
import { parsePlanJson } from "@server/cluster/outbound/executions/proxmox/provisioning/plan-parser.ts";
import {
  LOG_LATENCY_MS,
  LOG_LINES,
  LogTimeBuffer,
} from "@server/shared/executions/outbound/streaming/log-time-buffer.ts";
import { emitFrom } from "@server/shared/executions/outbound/streaming/emit-from.ts";
import {
  parseApplyStats,
  parseDestroyStats,
} from "@server/cluster/outbound/executions/proxmox/provisioning/output-parser.ts";

const PLAN_FILE = "plan.bin";
/**
 * Apply/destroy run with `-parallelism=1`. Provisioning's default
 * (parallelism=10) clones/destroys every VM concurrently; a weak
 * homelab Proxmox node cannot service many simultaneous qmclone
 * operations plus the provider's task-status polls, so the API
 * (pveproxy) times out one of them with HTTP 596. Serializing VM
 * creation trades a slower run for reliability — the homelab default.
 */
export function provisioningApplyArgs(parallelism = 1): string[] {
  return ["apply", "-input=false", "-auto-approve", `-parallelism=${parallelism}`];
}

export function provisioningDestroyArgs(parallelism = 1): string[] {
  return ["destroy", "-input=false", "-auto-approve", `-parallelism=${parallelism}`];
}

// Provisioning is grouped per node only.
type NodeGroup = {
  node: Node;
  virtualMachines: VirtualMachine[];
};

type RunDone = { code: number; stdout: string; stderr: string };

export class ProvisioningAdapter implements Provisioning {
  constructor(
    private readonly cli: ProvisioningCli,
    private readonly workingDir: WorkingDir,
    private readonly credentialResolver: CredentialResolver,
    private readonly tfvarsBuilder: TfvarsBuilder,
    private readonly provisioningEnv: ProvisioningEnv,
    private readonly ssh: SshCli,
    private readonly identity: IdentityProvider,
    private readonly preflight: CapacityPreflight,
  ) {}

  private async *capacityWarnings(
    connection: Connection,
    groups: readonly NodeGroup[],
  ): AsyncIterable<ExecutionEvent> {
    for (const group of groups) {
      for (
        const w of await this.preflight.warnings(
          connection,
          group.node,
          group.virtualMachines,
        )
      ) {
        yield new Log(w);
      }
    }
  }

  plan(cluster: ProxmoxCluster, nodeIds: NodeId[]): Task {
    return {
      run: (execution, emitter) => emitFrom(this.runPlan(cluster, nodeIds, execution), emitter),
    };
  }

  apply(cluster: ProxmoxCluster, nodeIds: NodeId[]): Task {
    return {
      run: (execution, emitter) => emitFrom(this.runApply(cluster, nodeIds, execution), emitter),
    };
  }

  destroy(cluster: ProxmoxCluster, nodeIds: NodeId[]): Task {
    return {
      run: (execution, emitter) => emitFrom(this.runDestroy(cluster, nodeIds, execution), emitter),
    };
  }

  private async *runPlan(
    cluster: ProxmoxCluster,
    nodeIds: NodeId[],
    execution: Execution,
  ): AsyncIterable<ExecutionEvent> {
    const connection = this.requireConnection(cluster);
    const { groups, skipped } = this.groups(cluster, nodeIds);
    for (const name of skipped) yield new Log(`⚠ skipping ${name} — no credential configured`);
    yield* this.capacityWarnings(connection, groups);

    for (const group of groups) {
      yield new Step("plan", `${group.node.name.value}`);
      const { dir, env } = await this.prepareWorkingDir(cluster, connection, group);
      try {
        yield* this.forwardLogs(
          this.cli.runOrThrow("init", {
            cwd: join(dir, "root"),
            args: this.initArgs(cluster, group),
            signal: execution.signal,
            env,
          }),
        );
        yield* this.forwardLogs(
          this.cli.runOrThrow("plan", {
            cwd: join(dir, "root"),
            args: ["plan", "-input=false", "-out=" + PLAN_FILE],
            signal: execution.signal,
            env,
          }),
        );

        const show = await this.collectSilent(
          this.cli.run({
            cwd: join(dir, "root"),
            args: ["show", "-json", PLAN_FILE],
            signal: execution.signal,
            env,
          }),
        );
        if (show.code !== 0) {
          throw new Error(`provisioning state read failed (exit ${show.code}): ${show.stderr}`);
        }

        const counts = parsePlanJson(show.stdout);
        yield new Log(
          `✓ ${group.node.name.value}: ` +
            `+${counts.toCreate} ~${counts.toUpdate} -${counts.toDelete}`,
        );
      } finally {
        await this.workingDir.discardTfvars(cluster.name.value, group.node.name.value);
      }
    }
  }

  private async *runApply(
    cluster: ProxmoxCluster,
    nodeIds: NodeId[],
    execution: Execution,
  ): AsyncIterable<ExecutionEvent> {
    const connection = this.requireConnection(cluster);
    const { groups, skipped } = this.groups(cluster, nodeIds);
    for (const name of skipped) yield new Log(`⚠ skipping ${name} — no credential configured`);
    yield* this.capacityWarnings(connection, groups);

    for (const group of groups) {
      yield new Step("apply", `${group.node.name.value}`);
      const { dir, env } = await this.prepareWorkingDir(cluster, connection, group);
      try {
        yield* this.forwardLogs(
          this.cli.runOrThrow("init", {
            cwd: join(dir, "root"),
            args: this.initArgs(cluster, group),
            signal: execution.signal,
            env,
          }),
        );

        const applyEvents = this.cli.runOrThrow("apply", {
          cwd: join(dir, "root"),
          args: provisioningApplyArgs(connection.policy.parallelism),
          signal: execution.signal,
          env,
        });
        const applyDone = yield* this.forwardAndCollect(applyEvents);
        const stats = parseApplyStats(applyDone.stdout);

        yield new Log(
          `✓ ${group.node.name.value}: ` +
            `+${stats.created} ~${stats.updated} -${stats.deleted}`,
        );
      } finally {
        await this.workingDir.discardTfvars(cluster.name.value, group.node.name.value);
      }
    }
  }

  private async *runDestroy(
    cluster: ProxmoxCluster,
    nodeIds: NodeId[],
    execution: Execution,
  ): AsyncIterable<ExecutionEvent> {
    const connection = this.requireConnection(cluster);
    const { groups, skipped } = this.groups(cluster, nodeIds);
    for (const name of skipped) yield new Log(`⚠ skipping ${name} — no credential configured`);

    for (const group of groups) {
      yield new Step("destroy", `${group.node.name.value}`);
      const { dir, env } = await this.prepareWorkingDir(cluster, connection, group);
      try {
        yield* this.forwardLogs(
          this.cli.runOrThrow("init", {
            cwd: join(dir, "root"),
            args: this.initArgs(cluster, group),
            signal: execution.signal,
            env,
          }),
        );

        const destroyEvents = this.cli.runOrThrow("destroy", {
          cwd: join(dir, "root"),
          args: provisioningDestroyArgs(connection.policy.parallelism),
          signal: execution.signal,
          env,
        });
        const destroyDone = yield* this.forwardAndCollect(destroyEvents);
        const stats = parseDestroyStats(destroyDone.stdout);

        yield new Log(
          `✓ ${group.node.name.value}: -${stats.deleted}`,
        );
      } finally {
        await this.workingDir.discardTfvars(cluster.name.value, group.node.name.value);
      }
    }
  }

  private initArgs(cluster: ProxmoxCluster, group: NodeGroup): string[] {
    const statePath = this.workingDir.stateFile(
      cluster.name.value,
      group.node.name.value,
    );
    return ["init", "-reconfigure", "-input=false", `-backend-config=path=${statePath}`];
  }

  // Per-line stdout is a firehose: batch consecutive lines through a
  // LogTimeBuffer so the single write path is not starved. `finally`
  // drains the tail on normal end AND on a thrown runner error, so the
  // last output is surfaced before the failure.
  private async *forwardLogs(events: AsyncIterable<RunEvent>): AsyncIterable<ExecutionEvent> {
    const logs = new LogTimeBuffer(LOG_LATENCY_MS, LOG_LINES);
    try {
      for await (const event of events) {
        if (event.type !== "log") continue;
        const chunk = logs.add(event.line);
        if (chunk !== null) yield new Log(chunk);
      }
    } finally {
      const tail = logs.drain();
      if (tail !== null) yield new Log(tail);
    }
  }

  private async *forwardAndCollect(
    events: AsyncIterable<RunEvent>,
  ): AsyncGenerator<ExecutionEvent, RunDone> {
    const logs = new LogTimeBuffer(LOG_LATENCY_MS, LOG_LINES);
    let done: RunDone | null = null;
    try {
      for await (const event of events) {
        if (event.type === "log") {
          const chunk = logs.add(event.line);
          if (chunk !== null) yield new Log(chunk);
        } else if (event.type === "done") {
          done = event;
        }
      }
    } finally {
      const tail = logs.drain();
      if (tail !== null) yield new Log(tail);
    }
    if (!done) throw new Error("cli stream ended without done event");
    return done;
  }

  /** Drains the stream without emitting logs — used for operations whose
   *  stdout is machine-readable and may carry sensitive data (e.g.
   *  `provisioning state read -json`). */
  private async collectSilent(events: AsyncIterable<RunEvent>): Promise<RunDone> {
    let done: RunDone | null = null;
    for await (const event of events) {
      if (event.type === "done") done = event;
    }
    if (!done) throw new Error("cli stream ended without done event");
    return done;
  }

  private async *disableKvmAndStart(
    execution: Execution,
    group: NodeGroup,
  ): AsyncIterable<ExecutionEvent> {
    // SSH-side automation runs key-based against the shared CLI identity;
    // the vault password isn't used here. Username still resolves from
    // the vault (Proxmox realm suffix stripped).
    const credential = await this.credentialResolver.resolve(
      group.node.credential.vault.value,
      group.node.credential.username.value,
      group.node.credential.password.value,
    );
    const user = credential.user.includes("@") ? credential.user.split("@")[0] : credential.user;
    const target = {
      host: group.node.ip.value,
      user,
      identityFile: await this.identity.ensureIdentity(),
    };

    for (const vm of group.virtualMachines) {
      const vmid = vm.id.value;
      yield new Log(`▶ disable kvm and start vm ${vmid} on ${group.node.name.value}`);

      let code = 0;
      let stdout = "";
      let stderr = "";
      for await (
        const event of this.ssh.run(
          target,
          `qm set ${vmid} --kvm 0 && qm start ${vmid}`,
          execution.signal,
        )
      ) {
        if (event.type === "log") {
          yield new Log(event.line);
        } else {
          code = event.code;
          stdout = event.stdout;
          stderr = event.stderr;
        }
      }
      if (code !== 0) {
        throw new Error(
          `failed to disable kvm and start vm ${vmid} on ${group.node.name.value} (exit ${code}): ${
            stderr || stdout
          }`,
        );
      }
    }
  }

  private groups(
    cluster: ProxmoxCluster,
    nodeIds: NodeId[],
  ): { groups: NodeGroup[]; skipped: string[] } {
    const filter = new Set(nodeIds.map((id) => id.value));
    const groups: NodeGroup[] = [];
    const skipped: string[] = [];
    for (const node of cluster.nodes.items) {
      if (filter.size > 0 && !filter.has(node.id.value)) continue;
      if (!this.hasCredential(node)) {
        skipped.push(node.name.value);
        continue;
      }
      // One provisioning group per node with all its VMs.
      // Nodes with no VMs have nothing to provision — skip silently.
      const virtualMachines = [...node.virtualMachines.items];
      if (virtualMachines.length === 0) continue;
      groups.push({ node, virtualMachines });
    }
    return { groups, skipped };
  }

  private requireConnection(cluster: ProxmoxCluster): Connection {
    const connection = cluster.connection;
    if (!connection) throw new ProviderNotConnected();
    return connection;
  }

  private hasCredential(node: Node): boolean {
    const c = node.credential;
    return c.isConfigured();
  }

  private async prepareWorkingDir(
    cluster: ProxmoxCluster,
    connection: Connection,
    group: NodeGroup,
  ): Promise<{ dir: string; env: Record<string, string> }> {
    const credential = await this.credentialResolver.resolve(
      group.node.credential.vault.value,
      group.node.credential.username.value,
      group.node.credential.password.value,
    );
    // The Proxmox credential and the state-encryption passphrase travel as
    // env, never in the tfvars — so no cleartext secret rests on disk.
    const env = await this.provisioningEnv.build(credential);
    const tfvars = await this.tfvarsBuilder.build(
      connection,
      group.node,
      group.virtualMachines,
    );
    const dir = await this.workingDir.prepare(
      cluster.name.value,
      group.node.name.value,
      tfvars,
    );
    return { dir, env };
  }
}
