import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import type { RegisterCluster } from "@server/cluster/application/commands/proxmox/register-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class RegisterClusterHandler {
  constructor(private readonly clusters: Clusters) {}

  /**
   * Returns the freshly-minted cluster id so inbound adapters can
   * surface it to the caller. The RPC adapter (TUI) ignores it for
   * compatibility with the existing Ack contract; the MCP adapter
   * echoes it back so an LLM agent can immediately operate on the
   * cluster it just created without an intermediate listing call.
   */
  async handle(command: RegisterCluster): Promise<{ clusterId: string }> {
    const name = new Name(command.name);

    if (await this.clusters.exists(name)) {
      throw new Error(`cluster '${name.value}' already exists.`);
    }

    const id = new Id();
    const cluster = ProxmoxCluster.register(
      id,
      name,
      new Creation(new User(command.user), new Hostname(command.host), new Instant()),
    );
    await this.clusters.add(cluster);
    return { clusterId: id.value };
  }
}
