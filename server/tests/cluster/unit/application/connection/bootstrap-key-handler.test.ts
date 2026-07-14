import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { BootstrapKeyHandler } from "@server/cluster/application/handlers/connection/bootstrap-key-handler.ts";
import type {
  SshBootstrap,
  SshBootstrapRequest,
  SshBootstrapResult,
} from "@server/shared/ssh/domain/ports/outbound/ssh-bootstrap.ts";
import type { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { CredentialResolver } from "@server/cluster/outbound/credential-resolver.ts";

const PUB_KEY = "ssh-ed25519 AAAAfake devstation-cli";
const CLUSTER_ID = "11111111-1111-1111-1111-111111111111";
const NODE_ID = "22222222-2222-2222-2222-222222222222";

/**
 * Loose duck-typed cluster aggregate — the handler only reads
 * `nodes.of(id)` from it, so a shape with the right method is enough.
 * Avoids dragging in every VO constructor just to wire a unit test.
 */
function fakeClusterWithNode(opts: {
  nodeId: string;
  ip: string;
  vaultId?: string;
  usernameSecret?: string;
  passwordSecret?: string;
}) {
  const node = {
    ip: { value: opts.ip },
    credential: {
      vault: { value: opts.vaultId ?? "vault-1" },
      username: { value: opts.usernameSecret ?? "user-secret" },
      password: { value: opts.passwordSecret ?? "password-secret" },
    },
  };
  return {
    nodes: {
      // deno-lint-ignore no-explicit-any
      of(id: any) {
        if (id.value !== opts.nodeId) {
          throw new Error(`node ${id.value} not found`);
        }
        return node;
      },
    },
  };
}

// deno-lint-ignore no-explicit-any
function stubClusters(cluster: any): Clusters {
  return {
    of: () => Promise.resolve(cluster),
  } as unknown as Clusters;
}

function stubCredentialResolver(user: string, password: string): CredentialResolver {
  return {
    resolve: () => Promise.resolve({ user, password }),
  } as unknown as CredentialResolver;
}

const stubIdentity = {
  ensureIdentity: () => Promise.resolve("/fake/devstation_ed25519"),
  publicKey: () => Promise.resolve(PUB_KEY),
} as unknown as IdentityProvider;

class RecordingBootstrap implements SshBootstrap {
  readonly calls: SshBootstrapRequest[] = [];
  constructor(private readonly result: SshBootstrapResult) {}
  installKey(request: SshBootstrapRequest): Promise<SshBootstrapResult> {
    this.calls.push(request);
    return Promise.resolve(this.result);
  }
}

describe("BootstrapKeyHandler", () => {
  it("resolves host from the node + user/password from the vault + key from IdentityProvider", async () => {
    /* @Given a cluster node plus stubbed vault credentials and identity */
    const cluster = fakeClusterWithNode({ nodeId: NODE_ID, ip: "192.168.15.191" });
    const bootstrap = new RecordingBootstrap({
      installed: true,
      alreadyPresent: false,
      pmxcfsDetected: true,
      backupPath: "/etc/pve/priv/authorized_keys.devstation-backup.x",
    });
    const sut = new BootstrapKeyHandler(
      stubClusters(cluster),
      stubCredentialResolver("root@pam", "secret"),
      stubIdentity,
      bootstrap,
    );

    /* @When the handler installs the key */
    const out = await sut.handle({ clusterId: CLUSTER_ID, nodeId: NODE_ID });

    /* @Then host/user/password/key are resolved from their proper sources and the result is returned */
    assertEquals(bootstrap.calls.length, 1);
    const sent = bootstrap.calls[0];
    assertEquals(sent.host, "192.168.15.191");
    // Proxmox realm-stripped: `root@pam` → `root`.
    assertEquals(sent.user, "root");
    assertEquals(sent.password, "secret");
    // Public key always comes from IdentityProvider — never from caller or vault.
    assertEquals(sent.publicKey, PUB_KEY);

    assertEquals(out.installed, true);
    assertEquals(out.alreadyPresent, false);
    assertEquals(out.pmxcfsDetected, true);
    assertEquals(out.backupPath, "/etc/pve/priv/authorized_keys.devstation-backup.x");
  });

  it("omits backupPath in the output when the key was already present", async () => {
    /* @Given a bootstrap result reporting the key was already present */
    const cluster = fakeClusterWithNode({ nodeId: NODE_ID, ip: "10.0.0.5" });
    const bootstrap = new RecordingBootstrap({
      installed: true,
      alreadyPresent: true,
      pmxcfsDetected: false,
    });
    const sut = new BootstrapKeyHandler(
      stubClusters(cluster),
      stubCredentialResolver("ubuntu", "secret"),
      stubIdentity,
      bootstrap,
    );

    /* @When the handler runs */
    const out = await sut.handle({ clusterId: CLUSTER_ID, nodeId: NODE_ID });

    /* @Then no backupPath is emitted */
    assertEquals(out.alreadyPresent, true);
    assertEquals(Object.hasOwn(out, "backupPath"), false);
  });

  it("does not strip non-realm usernames", async () => {
    /* @Given a credential without a Proxmox realm suffix */
    const cluster = fakeClusterWithNode({ nodeId: NODE_ID, ip: "10.0.0.5" });
    const bootstrap = new RecordingBootstrap({
      installed: true,
      alreadyPresent: false,
      pmxcfsDetected: false,
    });
    const sut = new BootstrapKeyHandler(
      stubClusters(cluster),
      stubCredentialResolver("ubuntu", "secret"),
      stubIdentity,
      bootstrap,
    );

    /* @When the handler runs */
    await sut.handle({ clusterId: CLUSTER_ID, nodeId: NODE_ID });

    /* @Then the username is passed through unchanged */
    assertEquals(bootstrap.calls[0].user, "ubuntu");
  });

  it("propagates a NodeNotFound when the node is missing in the cluster", async () => {
    /* @Given a cluster that does not contain the requested node */
    const cluster = fakeClusterWithNode({ nodeId: NODE_ID, ip: "10.0.0.5" });
    const bootstrap = new RecordingBootstrap({
      installed: true,
      alreadyPresent: false,
      pmxcfsDetected: false,
    });
    const sut = new BootstrapKeyHandler(
      stubClusters(cluster),
      stubCredentialResolver("ubuntu", "secret"),
      stubIdentity,
      bootstrap,
    );

    /* @When the handler is asked to bootstrap the missing node */
    /* @Then it rejects and never reaches the bootstrap step */
    await assertRejects(
      () =>
        sut.handle({
          clusterId: CLUSTER_ID,
          nodeId: "99999999-9999-9999-9999-999999999999",
        }),
      Error,
    );
    assertEquals(bootstrap.calls.length, 0);
  });
});
