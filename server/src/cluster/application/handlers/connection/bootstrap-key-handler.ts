import type { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";
import type { SshBootstrap } from "@server/shared/ssh/domain/ports/outbound/ssh-bootstrap.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { CredentialResolver } from "@server/cluster/outbound/credential-resolver.ts";
import { Id as ClusterId } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";

export type BootstrapKeyInput = {
  readonly clusterId: string;
  readonly nodeId: string;
};

export type BootstrapKeyOutput = {
  readonly installed: boolean;
  readonly alreadyPresent: boolean;
  readonly pmxcfsDetected: boolean;
  readonly backupPath?: string;
};

/**
 * Installs the DevStation automation public key on a registered node
 * so future SSH ops can go key-only. The caller passes only ids —
 * `host`, `user` and `password` are resolved server-side from the
 * cluster aggregate + the vault entries the node was registered
 * against. The password never crosses the wire and is never logged;
 * it flows from `CredentialResolver` straight into `SshBootstrap` and
 * is dropped after the single connection.
 *
 * Proxmox-specific today (the only provider with `nodes`). When other
 * providers grow node concepts this handler stays the shape but the
 * cast (`as ProxmoxCluster`) becomes a provider switch.
 */
export class BootstrapKeyHandler {
  constructor(
    private readonly clusters: Clusters,
    private readonly credentials: CredentialResolver,
    private readonly identity: IdentityProvider,
    private readonly bootstrap: SshBootstrap,
  ) {}

  async handle(input: BootstrapKeyInput): Promise<BootstrapKeyOutput> {
    // Even with the ssh2 adapter's defensive timeout, bootstrap_key
    // can hang with no trace output. Tracing each step to stderr keeps
    // the failure visible and diagnosable instead of opaque.
    trace(`bootstrap-handler: loading cluster ${input.clusterId}`);
    const cluster = await this.clusters.of<ProxmoxCluster>(new ClusterId(input.clusterId));

    trace(`bootstrap-handler: resolving node ${input.nodeId}`);
    const node = cluster.nodes.of(new NodeId(input.nodeId));

    trace("bootstrap-handler: resolving vault credentials");
    const credential = await this.credentials.resolve(
      node.credential.vault.value,
      node.credential.username.value,
      node.credential.password.value,
    );
    // Proxmox stores usernames with realm suffix (`root@pam`); SSH
    // wants the bare username. Mirrors what ProvisioningAdapter does
    // when shelling out — keep the two callers consistent.
    const sshUser = credential.user.includes("@") ? credential.user.split("@")[0] : credential.user;

    trace("bootstrap-handler: resolving local SSH public key");
    const publicKey = await this.identity.publicKey();

    trace(`bootstrap-handler: invoking bootstrap installKey on ${node.ip.value}`);
    const result = await this.bootstrap.installKey({
      host: node.ip.value,
      user: sshUser,
      password: credential.password,
      publicKey,
    });
    trace("bootstrap-handler: installKey returned");

    return {
      installed: result.installed,
      alreadyPresent: result.alreadyPresent,
      pmxcfsDetected: result.pmxcfsDetected,
      ...(result.backupPath !== undefined ? { backupPath: result.backupPath } : {}),
    };
  }
}

function trace(message: string): void {
  try {
    console.error(message);
  } catch {
    // never let logging break the handler
  }
}
