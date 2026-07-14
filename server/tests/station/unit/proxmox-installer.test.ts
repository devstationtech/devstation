import { assertEquals, assertGreater } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Blueprint,
  Compatibility,
  Description,
  Host,
  Name as BlueprintName,
  Role,
  SemVer,
  Step,
  StepDescription,
  StepId,
} from "@server/blueprint/index.ts";
import { Publish } from "@server/blueprint/domain/models/step/publish.ts";
import { Verify } from "@server/blueprint/domain/models/step/verify.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import type { Emitter } from "@server/shared/executions/domain/ports/outbound/emitter.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { Installation } from "@server/station/domain/models/service/installation.ts";
import type { ExecutionId } from "@server/shared/executions/domain/models/execution-id.ts";
import type { SshCli, SshEvent, Target } from "@server/shared/ssh/outbound/cli.ts";
import { Role as ServiceRole } from "@server/station/domain/models/service/role.ts";
import type {
  InstallContext,
  ResolvedInstance,
} from "@server/station/domain/ports/outbound/installer.ts";
import { ProxmoxInstaller } from "@server/station/outbound/installer/proxmox/installer.ts";

// ─── Test helpers ─────────────────────────────────────────────────────────────

type ScriptResponse = { code: number; stdout?: string; stderr?: string };

class FakeSshCli {
  public commands: string[] = [];
  private rules: Array<
    { match: (cmd: string) => boolean; response: ScriptResponse | (() => ScriptResponse) }
  > = [];

  on(predicate: (cmd: string) => boolean, response: ScriptResponse | (() => ScriptResponse)): void {
    this.rules.push({ match: predicate, response });
  }

  async *run(_target: Target, command: string, _signal?: AbortSignal): AsyncIterable<SshEvent> {
    this.commands.push(command);
    const rule = this.rules.find((r) => r.match(command));
    const response = typeof rule?.response === "function" ? rule.response() : rule?.response ??
      { code: 0, stdout: "", stderr: "" };
    if (response.stdout) yield { type: "log", stream: "stdout", line: response.stdout };
    if (response.stderr) yield { type: "log", stream: "stderr", line: response.stderr };
    yield {
      type: "done",
      code: response.code,
      stdout: response.stdout ?? "",
      stderr: response.stderr ?? "",
    };
  }
}

function fakeExecution(): Execution {
  const controller = new AbortController();
  return {
    id: "test-execution" as ExecutionId,
    signal: controller.signal,
    watch: async function* () {},
  };
}

function instance(role: string, host: string): ResolvedInstance {
  return {
    role: new ServiceRole(role),
    host,
    user: "ubuntu",
  };
}

/**
 * Stub IdentityProvider — returns a fixed fake key path so installer
 * doesn't try to spawn ssh-keygen during unit tests.
 */
const stubIdentity = {
  ensureIdentity: () => Promise.resolve("/fake/devstation_ed25519"),
  publicKey: () => Promise.resolve("ssh-ed25519 AAAA fake"),
} as unknown as import("@server/shared/ssh/outbound/identity.ts").IdentityProvider;

function step(
  name: string,
  shell: string,
  opts: {
    verify?: Verify;
    publish?: Publish;
    env?: Record<string, string>;
    rollback?: string;
  } = {},
): Step {
  return new Step(
    new StepId(name),
    new StepDescription(name),
    shell,
    opts.env ?? {},
    opts.verify ?? null,
    opts.publish ?? new Publish({}, {}),
    opts.rollback ?? null,
  );
}

function baseBlueprint(name: string, roles: Role[]): Blueprint {
  return new Blueprint(
    new BlueprintName(name),
    new Description(name),
    new SemVer("1.0.0"),
    new Compatibility([OperatingSystem.UBUNTU_22_04]),
    "exclusive",
    [],
    roles,
    null,
    [],
  );
}

function hostedBlueprint(
  name: string,
  hostBlueprint: string,
  hostRole: string,
  steps: Step[],
): Blueprint {
  return new Blueprint(
    new BlueprintName(name),
    new Description(name),
    new SemVer("1.0.0"),
    new Compatibility([OperatingSystem.UBUNTU_22_04]),
    "exclusive",
    [],
    [],
    new Host(new BlueprintName(hostBlueprint), hostRole),
    steps,
  );
}

/**
 * Drives the installer Task to completion: collects emitted events
 * (provisioning-shaped — logs/steps only, no terminals) and resolves with
 * the returned `Installation[]`, or captures the thrown error on failure.
 */
async function runInstall(
  task: Task<readonly Installation[]>,
  execution: Execution = fakeExecution(),
): Promise<{
  outputs: ExecutionEvent[];
  logs: string[];
  installations: readonly Installation[] | null;
  error: Error | null;
}> {
  const outputs: ExecutionEvent[] = [];
  const logs: string[] = [];
  const emitter: Emitter = {
    emit: (event) => {
      outputs.push(event);
      if (event instanceof Log) logs.push(event.line);
    },
  };
  try {
    const installations = await task.run(execution, emitter);
    return { outputs, logs, installations, error: null };
  } catch (err) {
    return { outputs, logs, installations: null, error: err as Error };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProxmoxInstaller — standalone single role", () => {
  it("should run the step's shell on the instance and emit Succeeded", async () => {
    /* @Given a blueprint with 1 role 'main' containing 1 step that runs apt-get */
    const ssh = new FakeSshCli();
    const blueprint = baseBlueprint("docker", [
      new Role("main", "one", [step("install", "apt-get install foo")]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("main", "10.0.0.1")],
    };
    const { logs, installations, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then it returns one Installation without error and sent the step command via ssh */
    assertEquals(error, null);
    assertEquals(Array.isArray(installations), true);
    assertEquals(installations!.length, 1);
    const ranInstall = ssh.commands.some((c) => c.includes("apt-get install foo"));
    assertEquals(ranInstall, true);
    assertGreater(logs.length, 0);
  });

  it("should skip the step when verify reports healthy upfront", async () => {
    /* @Given a step with verify whose shell exits 0 (healthy) */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("test-healthy"), { code: 0 });
    ssh.on((cmd) => cmd.includes("apply-foo"), { code: 0 });

    const blueprint = baseBlueprint("docker", [
      new Role("main", "one", [
        step("install", "apply-foo", { verify: new Verify("test-healthy", 1, 0) }),
      ]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("main", "10.0.0.1")],
    };
    const { logs, installations, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then the apply shell was not sent and a Installation is returned */
    assertEquals(error, null);
    assertEquals(installations !== null, true);
    const applied = ssh.commands.some((c) => c.includes("apply-foo"));
    assertEquals(applied, false);
    const skipped = logs.some((l) => l.includes("healthy (skip)"));
    assertEquals(skipped, true);
  });

  it("should emit Failed when the step's shell exits non-zero", async () => {
    /* @Given a step whose shell exits with exit code 1 */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("apply-fail"), { code: 1, stderr: "boom" });

    const blueprint = baseBlueprint("docker", [
      new Role("main", "one", [step("install", "apply-fail")]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("main", "10.0.0.1")],
    };
    const { installations, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then it throws (no Installation) with stderr in the error message */
    assertEquals(installations, null);
    assertEquals(error?.message.includes("boom"), true);
  });
});

// Regression: register-service-handler was fixed to skip `zeroOrMore`
// roles without instances, but the installer's standalone loop was
// missed. Single-node k3s (`server` only) ran install + publish-token
// successfully, then the installer crashed on `agent` and marked the
// service FAILED. This pins the skip in the installer.
describe("ProxmoxInstaller — zeroOrMore role with zero instances", () => {
  it("skips a `zeroOrMore` role when no instances are assigned, succeeding with the served roles", async () => {
    const ssh = new FakeSshCli();
    // Blueprint mirrors k3s: required `server` (one) + optional `agent` (zeroOrMore).
    const blueprint = baseBlueprint("k3s", [
      new Role("server", "one", [step("install", "echo install-server")]),
      new Role("agent", "zeroOrMore", [step("install", "echo install-agent")]),
    ]);
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      // Only the server instance — agent is opted out.
      instances: [instance("server", "10.0.0.1")],
    };
    const { error, installations, logs } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    // Install completes; one installation (the server) is recorded.
    assertEquals(error, null);
    assertEquals(installations!.length, 1);

    // Server step ran, agent step did NOT (no `install-agent` issued).
    const ranServer = ssh.commands.some((c) => c.includes("install-server"));
    const ranAgent = ssh.commands.some((c) => c.includes("install-agent"));
    assertEquals(ranServer, true);
    assertEquals(ranAgent, false);

    // Sanity — no `no instance assigned` error in any log line.
    const sawError = logs.some((l) => l.includes("no instance assigned"));
    assertEquals(sawError, false);
  });

  it("still fails when a `one`-cardinality role has no instance (back-compat)", async () => {
    const ssh = new FakeSshCli();
    const blueprint = baseBlueprint("invalid", [
      new Role("server", "one", [step("install", "echo install")]),
    ]);
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [], // no instances at all
    };
    const { error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    assertEquals(error?.message.includes("no instance assigned to role 'server'"), true);
  });
});

describe("ProxmoxInstaller — clustered with peer handoff", () => {
  it("agent role reads secret published by server role via env templates", async () => {
    /* @Given the server publishes k3sToken via stdout-line and the agent references it via env+templates */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("server-publish"), {
      code: 0,
      stdout: "K3S_TOKEN=TOKEN-123\n",
    });

    const serverStep = step("publish-token", "server-publish", {
      publish: new Publish(
        { k3sToken: { kind: "stdoutLine", prefix: "K3S_TOKEN=" } },
        {},
      ),
    });
    const agentStep = step("join", "agent-join", {
      env: {
        K3S_URL: "https://${peer.server.host}:6443",
        K3S_TOKEN: "${peer.server.secrets.k3sToken}",
      },
    });

    const blueprint = baseBlueprint("k3s", [
      new Role("server", "one", [serverStep]),
      new Role("agent", "many", [agentStep]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [
        instance("server", "10.0.0.1"),
        instance("agent", "10.0.0.2"),
      ],
    };
    const { installations, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then the agent received host and token from the server peer via export env */
    assertEquals(error, null);
    assertEquals(installations !== null, true);
    const agentCommand = ssh.commands.find((c) => c.includes("agent-join"));
    assertEquals(agentCommand !== undefined, true);
    assertEquals(agentCommand!.includes("export K3S_URL='https://10.0.0.1:6443'"), true);
    assertEquals(agentCommand!.includes("export K3S_TOKEN='TOKEN-123'"), true);
    assertEquals(installations!.length, 2);
  });
});

describe("ProxmoxInstaller — hosted", () => {
  it("should run top-level steps on each host instance, no role iteration", async () => {
    /* @Given a hosted blueprint with 2 top-level steps */
    const ssh = new FakeSshCli();
    const blueprint = hostedBlueprint("argocd", "k3s", "server", [
      step("namespace", "echo namespace"),
      step("install", "echo install"),
    ]);

    /* @When the installer runs with the instance inherited from the host service */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("server", "10.0.0.1")],
    };
    const { installations, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then the 2 steps ran in order on the single instance */
    assertEquals(error, null);
    const orderedRuns = ssh.commands.filter((c) =>
      c.includes("echo namespace") || c.includes("echo install")
    );
    const namespaceFirst = orderedRuns[0]?.includes("echo namespace");
    const installSecond = orderedRuns[1]?.includes("echo install");
    assertEquals(namespaceFirst, true);
    assertEquals(installSecond, true);
    assertEquals(installations!.length, 1);
  });
});

describe("ProxmoxInstaller — secret hygiene", () => {
  it("never streams a stdoutLine-published secret to the execution log, yet extracts it", async () => {
    /* @Given a step that prints the token it publishes as a secret */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("k3s-install"), {
      code: 0,
      stdout: "TOKEN=K10-super-secret-node-token",
    });
    const blueprint = baseBlueprint("k3s", [
      new Role("server", "one", [
        step("k3s-install", "k3s-install --server", {
          publish: new Publish({ token: { kind: "stdoutLine", prefix: "TOKEN=" } }, {}),
        }),
      ]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("server", "10.0.0.1")],
    };
    const { logs, installations, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then the secret value never appears in any emitted log line */
    assertEquals(error, null);
    assertEquals(logs.some((l) => l.includes("K10-super-secret-node-token")), false);
    /* @And the publish line is visible but cut at the prefix */
    assertEquals(logs.some((l) => l.includes("TOKEN=[redacted]")), true);
    /* @And the installer still returns the real value for the install event */
    assertEquals(installations![0].result.secrets.token, "K10-super-secret-node-token");
  });

  it("reads file-sourced secrets over a quiet transport — the cat output never hits the log", async () => {
    /* @Given a step publishing a secret from a remote file */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("install"), { code: 0, stdout: "installed" });
    ssh.on((cmd) => cmd.includes("sudo cat"), {
      code: 0,
      stdout: "file-secret-value-42",
    });
    const blueprint = baseBlueprint("svc", [
      new Role("main", "one", [
        step("install", "install-svc", {
          publish: new Publish(
            { nodeToken: { kind: "file", path: "/var/lib/svc/token" } },
            {},
          ),
        }),
      ]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("main", "10.0.0.1")],
    };
    const { logs, installations, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then the file's content never appears in any emitted log line */
    assertEquals(error, null);
    assertEquals(logs.some((l) => l.includes("file-secret-value-42")), false);
    /* @And the value was still extracted for the install event */
    assertEquals(installations![0].result.secrets.nodeToken, "file-secret-value-42");
  });

  it("scrubs resolved service secrets echoed by a step, including failure messages", async () => {
    /* @Given a step that echoes a resolved secret and fails */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("login"), {
      code: 1,
      stdout: "auth failed for key vault-secret-xyz-99",
    });
    const blueprint = baseBlueprint("svc", [
      new Role("main", "one", [step("login", "login --key {{secrets.apiKey}}")]),
    ]);

    /* @When the install runs with the resolved secret in scope */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: { apiKey: "vault-secret-xyz-99" },
      instances: [instance("main", "10.0.0.1")],
    };
    const { logs, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then neither the logs nor the failure message leak the value */
    assertEquals(logs.some((l) => l.includes("vault-secret-xyz-99")), false);
    assertEquals(error !== null, true);
    assertEquals(error!.message.includes("vault-secret-xyz-99"), false);
    assertEquals(error!.message.includes("[redacted]"), true);
  });
});

describe("ProxmoxInstaller — step rollback (DSL contract)", () => {
  it("runs the failing step's rollback, keeps the original error, and logs the compensation", async () => {
    /* @Given a step with a rollback whose shell fails */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("install-docker"), { code: 1, stdout: "apt explodes" });
    ssh.on((cmd) => cmd.includes("remove -y docker"), { code: 0, stdout: "removed" });
    const blueprint = baseBlueprint("docker", [
      new Role("main", "one", [
        step("install", "install-docker", { rollback: "sudo apt-get remove -y docker" }),
      ]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("main", "10.0.0.1")],
    };
    const { logs, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then the rollback shell was executed on the instance */
    assertEquals(ssh.commands.some((c) => c.includes("remove -y docker")), true);
    /* @And the run still fails with the step's original error */
    assertEquals(error !== null, true);
    assertEquals(error!.message.includes("install failed"), true);
    /* @And the log narrates the compensation */
    assertEquals(logs.some((l) => l.includes("↩ install rollback")), true);
    assertEquals(logs.some((l) => l.includes("↩ install rollback done")), true);
  });

  it("a rollback that itself fails never masks the original error", async () => {
    /* @Given a failing step whose rollback also exits non-zero */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("install-docker"), { code: 1, stdout: "boom" });
    ssh.on((cmd) => cmd.includes("undo-install"), { code: 7, stdout: "cannot undo" });
    const blueprint = baseBlueprint("docker", [
      new Role("main", "one", [step("install", "install-docker", { rollback: "undo-install" })]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("main", "10.0.0.1")],
    };
    const { logs, error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then the original step failure is what surfaces */
    assertEquals(error!.message.includes("install failed"), true);
    /* @And the incomplete compensation is reported, best-effort */
    assertEquals(logs.some((l) => l.includes("rollback exited 7")), true);
  });

  it("never runs the rollback when the step succeeds", async () => {
    /* @Given a succeeding step that declares a rollback */
    const ssh = new FakeSshCli();
    ssh.on((cmd) => cmd.includes("install-docker"), { code: 0, stdout: "ok" });
    const blueprint = baseBlueprint("docker", [
      new Role("main", "one", [step("install", "install-docker", { rollback: "undo-install" })]),
    ]);

    /* @When the installer runs */
    const ctx: InstallContext = {
      blueprint,
      inputs: {},
      secrets: {},
      instances: [instance("main", "10.0.0.1")],
    };
    const { error } = await runInstall(
      new ProxmoxInstaller(ssh as unknown as SshCli, stubIdentity).install(ctx),
    );

    /* @Then no rollback command was ever sent */
    assertEquals(error, null);
    assertEquals(ssh.commands.some((c) => c.includes("undo-install")), false);
  });
});
