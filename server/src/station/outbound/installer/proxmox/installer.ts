import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { Emitter } from "@server/shared/executions/domain/ports/outbound/emitter.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { SshCli, Target } from "@server/shared/ssh/outbound/cli.ts";
import type { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";
import { waitForSshReady } from "@server/shared/ssh/outbound/wait-for-ready.ts";
import { SshAdapter } from "@server/shared/ssh/outbound/adapter.ts";
import type { Peer, Step } from "@server/blueprint/index.ts";
import type {
  InstallContext,
  Installer,
  ResolvedInstance,
} from "@server/station/domain/ports/outbound/installer.ts";
import { RuntimeStepContext } from "@server/station/outbound/installer/proxmox/step-context.ts";
import { AsyncQueue } from "@server/station/outbound/installer/proxmox/async-queue.ts";
import { SecretRedactor } from "@server/station/outbound/installer/proxmox/runner/secret-redactor.ts";
import { runApply } from "@server/station/outbound/installer/proxmox/runner/run-apply.ts";
import { runRollback } from "@server/station/outbound/installer/proxmox/runner/run-rollback.ts";
import { runVerify } from "@server/station/outbound/installer/proxmox/runner/run-verify.ts";
import { Installation } from "@server/station/domain/models/service/installation.ts";
import { InstallResult } from "@server/station/domain/models/service/install-result.ts";

/**
 * Executes a service install against Proxmox VMs via SSH.
 *
 * Iterates `stack.roles` in declared order. For each role, runs every
 * instance assigned to it (sequentially), publishing each completion's
 * `(secrets, outputs)` to a peers map that subsequent roles read via
 * `ctx.fromRole(name)`. Single-role stacks are the degenerate case: one
 * role, one (or more) instances, empty peers map.
 *
 * Master/slave handoff (k3s server→agent, postgres primary→replica, etc) is
 * handled by this loop alone — stack authors only declare roles + steps.
 *
 * Per-instance pre-flight: waits for sshd to come up before running the
 * first step (cloud-init on a freshly-provisioned VM takes minutes).
 *
 * Shape note: this is a plain `Task` like the provisioning runner — it streams
 * Log/Step via the emitter and **never emits terminals**. Success is the
 * returned `Installation[]`; failure is a thrown error; cancellation is the
 * aborted signal. The in-process orchestrator (`runServiceInstall`) owns
 * the Station mutation and the terminal, exactly mirroring how
 * `ApplyNodesHandler` consumes the provisioning Task.
 */
export class ProxmoxInstaller implements Installer {
  constructor(
    private readonly ssh: SshCli,
    private readonly identity: IdentityProvider,
  ) {}

  install(ctx: InstallContext): Task<readonly Installation[]> {
    const ssh = this.ssh;
    const identity = this.identity;
    return {
      run: (execution, emitter) => runInstall(ssh, identity, ctx, execution, emitter),
    };
  }

  uninstall(ctx: InstallContext): Task<void> {
    const ssh = this.ssh;
    const identity = this.identity;
    return {
      run: (execution, emitter) => runUninstall(ssh, identity, ctx, execution, emitter),
    };
  }
}

/** Cancellation is a thrown error; the runtime/orchestrator turns the
 * aborted signal into the `Cancelled` terminal. */
function ensureNotAborted(execution: Execution): void {
  if (execution.signal.aborted) throw new Error("install cancelled");
}

async function runInstall(
  ssh: SshCli,
  identity: IdentityProvider,
  ctx: InstallContext,
  execution: Execution,
  emitter: Emitter,
): Promise<readonly Installation[]> {
  // Resolve the shared automation key once for the whole install; the
  // path is reused for every instance.
  const identityFile = await identity.ensureIdentity();
  const peers = new Map<string, Peer[]>();
  const allInstallations: Installation[] = [];

  if (ctx.blueprint.isHosted) {
    // Hosted: run the blueprint's top-level steps on every host instance the
    // resolver provided. The peers map stays empty — hosted blueprints don't
    // have their own roles to publish from.
    for (const instance of ctx.instances) {
      ensureNotAborted(execution);
      allInstallations.push(
        await runInstance(
          ssh,
          identityFile,
          ctx,
          instance.role.name,
          ctx.blueprint.installSteps,
          instance,
          peers as ReadonlyMap<string, readonly Peer[]>,
          execution,
          emitter,
        ),
      );
    }
  } else {
    // Standalone: iterate roles in declared order, accumulate peers between
    // roles so later roles read earlier ones via ctx.fromRole(name).
    for (const role of ctx.blueprint.roles) {
      ensureNotAborted(execution);
      const matching = ctx.instances.filter((i) => i.role.name === role.name);
      if (matching.length === 0) {
        // The register handler already skips `zeroOrMore` roles without
        // instances; the executor must do the same. Single-node k3s
        // installs (`server` only) would otherwise succeed through
        // install + publish-token, then crash on `agent` and mark the
        // service FAILED — masking the actual success. Skip optional
        // roles here too; `one` and `many` are validated at register.
        if (role.instances === "zeroOrMore") continue;
        throw new Error(`no instance assigned to role '${role.name}'.`);
      }
      for (const instance of matching) {
        const installation = await runInstance(
          ssh,
          identityFile,
          ctx,
          role.name,
          role.installSteps,
          instance,
          peers as ReadonlyMap<string, readonly Peer[]>,
          execution,
          emitter,
        );
        allInstallations.push(installation);

        const peer: Peer = {
          role: { name: role.name },
          host: instance.host,
          secrets: installation.result.secrets,
          outputs: installation.result.outputs,
        };
        const existing = peers.get(role.name) ?? [];
        peers.set(role.name, [...existing, peer]);
      }
    }
  }

  return allInstallations;
}

async function runInstance(
  ssh: SshCli,
  identityFile: string,
  ctx: InstallContext,
  roleName: string,
  steps: readonly Step[],
  instance: ResolvedInstance,
  peers: ReadonlyMap<string, readonly Peer[]>,
  execution: Execution,
  emitter: Emitter,
): Promise<Installation> {
  const target: Target = { host: instance.host, user: instance.user, identityFile };
  const stackName = ctx.blueprint.name.value;

  emitter.emit(new Log(`▶ ${stackName}/${roleName} on ${instance.host}`));

  try {
    for await (const status of waitForSshReady(ssh, target, execution.signal)) {
      emitter.emit(new Log(status));
    }
  } catch (err) {
    if (execution.signal.aborted) throw new Error("install cancelled");
    throw new Error(shortError(err));
  }

  const publishedSecrets = new Map<string, string>();
  const publishedOutputs = new Map<string, string>();

  // Everything emitted to the execution log goes through this redactor:
  // declared stdoutLine-publish prefixes are cut, and every secret value
  // known to the run (resolved + published so far + peers) is scrubbed
  // wherever it appears. The provider reads the live maps, so values
  // published mid-run are redacted from that point on.
  const redactor = new SecretRedactor(
    steps.flatMap((s) =>
      Object.values(s.publish.secrets)
        .filter((src) => src.kind === "stdoutLine")
        .map((src) => src.prefix)
    ),
    () => [
      ...Object.values(ctx.secrets),
      ...publishedSecrets.values(),
      ...[...peers.values()].flatMap((ps) => ps.flatMap((p) => Object.values(p.secrets))),
    ],
  );
  // Publish reads (`sudo cat` of a declared secret file) must never stream
  // to the log — quiet transport, no sink.
  const quietSsh = new SshAdapter(ssh, target, execution.signal);

  for (const step of steps) {
    ensureNotAborted(execution);

    const stepName = step.id.value;
    const startedAt = Date.now();
    emitter.emit(new Log(`  ${stackName}/${roleName}/${stepName}`));

    if (
      await alreadyHealthy(
        ssh,
        identityFile,
        ctx,
        step,
        instance,
        peers,
        publishedSecrets,
        publishedOutputs,
      )
    ) {
      emitter.emit(new Log(`  ✓ ${stepName} healthy (skip)`));
      continue;
    }

    const queue = new AsyncQueue<ExecutionEvent>();
    const sshAdapter = new SshAdapter(
      ssh,
      target,
      execution.signal,
      (stream, line) => queue.push(new Log(`    [${stepName}/${stream}] ${redactor.line(line)}`)),
    );
    const stepContext = new RuntimeStepContext(
      ctx.inputs,
      ctx.secrets,
      publishedSecrets,
      publishedOutputs,
      sshAdapter,
      instance.role,
      instance.host,
      peers,
    );

    let applyError: unknown = null;
    const applyTask = (async () => {
      try {
        for await (
          const event of runApply({ step, ctx: stepContext, redactor, publishSsh: quietSsh })
        ) {
          if (execution.signal.aborted) return;
          if (event.type === "log") {
            queue.push(new Log(`    [${stepName}] ${event.message}`));
          } else if (event.type === "secret") {
            publishedSecrets.set(event.name, event.value);
          } else if (event.type === "fact") {
            publishedOutputs.set(event.name, event.value);
          }
        }
      } catch (err) {
        applyError = err;
      } finally {
        queue.close();
      }
    })();

    for await (const out of queue.drain()) {
      if (execution.signal.aborted) {
        await applyTask;
        throw new Error("install cancelled");
      }
      emitter.emit(out);
    }
    await applyTask;

    if (applyError) {
      // DSL contract (`step.rollback`): compensation shell executed when the
      // step fails. Best-effort by design — its output is logged, its own
      // failure is logged too, and neither masks the original error. Runs
      // for any failure inside the step's apply (non-zero shell or a publish
      // read error after the shell mutated the host): either way the install
      // is failing and the step's changes should be compensated.
      if (step.rollback) {
        emitter.emit(new Log(`  ↩ ${stepName} rollback`));
        try {
          for await (const event of runRollback({ shell: step.rollback, ctx: stepContext })) {
            if (event.type === "log") {
              emitter.emit(new Log(`    [${stepName}/rollback] ${redactor.line(event.message)}`));
            }
          }
          emitter.emit(new Log(`  ↩ ${stepName} rollback done`));
        } catch (err) {
          emitter.emit(
            new Log(
              `  ↩ ${stepName} rollback failed: ${redactor.line(shortError(err))} (continuing)`,
            ),
          );
        }
      }
      throw new Error(
        `${stackName}/${roleName}/${stepName} failed: ${redactor.line(shortError(applyError))}`,
      );
    }

    if (step.verify) {
      let result;
      try {
        result = await runVerify({ verify: step.verify, ctx: stepContext });
      } catch (err) {
        throw new Error(
          `${stackName}/${roleName}/${stepName} verify error: ${redactor.line(shortError(err))}`,
        );
      }
      if (!result.healthy) {
        const reason = redactor.line(result.reason ?? "verify failed");
        throw new Error(`${stackName}/${roleName}/${stepName} verify failed: ${reason}`);
      }
    }

    emitter.emit(new Log(`  ✓ ${stepName} (${Date.now() - startedAt}ms)`));
  }

  return new Installation(
    instance.role,
    instance.host,
    new InstallResult(
      { version: ctx.blueprint.version.value },
      Object.fromEntries(publishedSecrets),
      Object.fromEntries(publishedOutputs),
    ),
    new Instant(),
  );
}

async function alreadyHealthy(
  ssh: SshCli,
  identityFile: string,
  ctx: InstallContext,
  step: Step,
  instance: ResolvedInstance,
  peers: ReadonlyMap<string, readonly Peer[]>,
  publishedSecrets: Map<string, string>,
  publishedOutputs: Map<string, string>,
): Promise<boolean> {
  if (!step.verify) return false;
  const target: Target = { host: instance.host, user: instance.user, identityFile };
  try {
    const probeAdapter = new SshAdapter(ssh, target, new AbortController().signal);
    const probeContext = new RuntimeStepContext(
      ctx.inputs,
      ctx.secrets,
      publishedSecrets,
      publishedOutputs,
      probeAdapter,
      instance.role,
      instance.host,
      peers,
    );
    const result = await runVerify({ verify: step.verify, ctx: probeContext });
    return result.healthy;
  } catch {
    return false;
  }
}

function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const first = message.split("\n").map((l) => l.trim()).find(Boolean) ?? message;
  return first.length > 200 ? first.slice(0, 197) + "..." : first;
}

/**
 * Tears down a service: runs the blueprint's `uninstall` steps per instance.
 * Standalone iterates roles in **reverse** declared order (dependents before
 * their hosts); hosted runs its top-level uninstall steps on each host instance.
 * No peer propagation — teardown steps are self-contained.
 */
async function runUninstall(
  ssh: SshCli,
  identity: IdentityProvider,
  ctx: InstallContext,
  execution: Execution,
  emitter: Emitter,
): Promise<void> {
  const identityFile = await identity.ensureIdentity();

  if (ctx.blueprint.isHosted) {
    for (const instance of ctx.instances) {
      if (execution.signal.aborted) throw new Error("uninstall cancelled");
      await runUninstallInstance(
        ssh,
        identityFile,
        ctx,
        instance.role.name,
        ctx.blueprint.uninstallSteps,
        instance,
        execution,
        emitter,
      );
    }
    return;
  }

  for (const role of [...ctx.blueprint.roles].reverse()) {
    if (execution.signal.aborted) throw new Error("uninstall cancelled");
    const matching = ctx.instances.filter((i) => i.role.name === role.name);
    if (matching.length === 0) {
      if (role.instances === "zeroOrMore") continue;
      throw new Error(`no instance assigned to role '${role.name}'.`);
    }
    for (const instance of matching) {
      await runUninstallInstance(
        ssh,
        identityFile,
        ctx,
        role.name,
        role.uninstallSteps,
        instance,
        execution,
        emitter,
      );
    }
  }
}

async function runUninstallInstance(
  ssh: SshCli,
  identityFile: string,
  ctx: InstallContext,
  roleName: string,
  steps: readonly Step[],
  instance: ResolvedInstance,
  execution: Execution,
  emitter: Emitter,
): Promise<void> {
  const target: Target = { host: instance.host, user: instance.user, identityFile };
  const stackName = ctx.blueprint.name.value;

  emitter.emit(new Log(`▶ teardown ${stackName}/${roleName} on ${instance.host}`));
  if (steps.length === 0) {
    emitter.emit(new Log(`  (no teardown steps — nothing to run)`));
    return;
  }

  // Tolerate an unreachable host: the VM may already be gone (infra torn down
  // first). Treat that as already-uninstalled rather than a teardown failure.
  try {
    for await (const status of waitForSshReady(ssh, target, execution.signal)) {
      emitter.emit(new Log(status));
    }
  } catch (err) {
    if (execution.signal.aborted) throw new Error("uninstall cancelled");
    emitter.emit(new Log(`  host unreachable — assuming already torn down (${shortError(err)})`));
    return;
  }

  const publishedSecrets = new Map<string, string>();
  const publishedOutputs = new Map<string, string>();
  const peers: ReadonlyMap<string, readonly Peer[]> = new Map();
  const redactor = new SecretRedactor(
    [],
    () => [...Object.values(ctx.secrets), ...publishedSecrets.values()],
  );
  const quietSsh = new SshAdapter(ssh, target, execution.signal);

  for (const step of steps) {
    if (execution.signal.aborted) throw new Error("uninstall cancelled");

    const stepName = step.id.value;
    const startedAt = Date.now();
    emitter.emit(new Log(`  ${stackName}/${roleName}/${stepName}`));

    // For teardown, a passing verify means "already gone" → skip (idempotent).
    if (
      await alreadyHealthy(
        ssh,
        identityFile,
        ctx,
        step,
        instance,
        peers,
        publishedSecrets,
        publishedOutputs,
      )
    ) {
      emitter.emit(new Log(`  ✓ ${stepName} already removed (skip)`));
      continue;
    }

    const queue = new AsyncQueue<ExecutionEvent>();
    const sshAdapter = new SshAdapter(
      ssh,
      target,
      execution.signal,
      (stream, line) => queue.push(new Log(`    [${stepName}/${stream}] ${redactor.line(line)}`)),
    );
    const stepContext = new RuntimeStepContext(
      ctx.inputs,
      ctx.secrets,
      publishedSecrets,
      publishedOutputs,
      sshAdapter,
      instance.role,
      instance.host,
      peers,
    );

    let applyError: unknown = null;
    const applyTask = (async () => {
      try {
        for await (
          const event of runApply({ step, ctx: stepContext, redactor, publishSsh: quietSsh })
        ) {
          if (execution.signal.aborted) return;
          if (event.type === "log") {
            queue.push(new Log(`    [${stepName}] ${event.message}`));
          } else if (event.type === "secret") {
            publishedSecrets.set(event.name, event.value);
          } else if (event.type === "fact") {
            publishedOutputs.set(event.name, event.value);
          }
        }
      } catch (err) {
        applyError = err;
      } finally {
        queue.close();
      }
    })();

    for await (const out of queue.drain()) {
      if (execution.signal.aborted) {
        await applyTask;
        throw new Error("uninstall cancelled");
      }
      emitter.emit(out);
    }
    await applyTask;

    if (applyError) {
      if (step.rollback) {
        emitter.emit(new Log(`  ↩ ${stepName} rollback`));
        try {
          for await (const event of runRollback({ shell: step.rollback, ctx: stepContext })) {
            if (event.type === "log") {
              emitter.emit(new Log(`    [${stepName}/rollback] ${redactor.line(event.message)}`));
            }
          }
        } catch (err) {
          emitter.emit(
            new Log(`  ↩ ${stepName} rollback failed: ${redactor.line(shortError(err))}`),
          );
        }
      }
      throw new Error(
        `${stackName}/${roleName}/${stepName} failed: ${redactor.line(shortError(applyError))}`,
      );
    }

    if (step.verify) {
      let result;
      try {
        result = await runVerify({ verify: step.verify, ctx: stepContext });
      } catch (err) {
        throw new Error(
          `${stackName}/${roleName}/${stepName} verify error: ${redactor.line(shortError(err))}`,
        );
      }
      if (!result.healthy) {
        const reason = redactor.line(result.reason ?? "verify failed");
        throw new Error(`${stackName}/${roleName}/${stepName} verify failed: ${reason}`);
      }
    }

    emitter.emit(new Log(`  ✓ ${stepName} (${Date.now() - startedAt}ms)`));
  }
}
