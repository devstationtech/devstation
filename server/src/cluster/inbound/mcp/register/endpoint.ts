import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { JsonSchema } from "@server/shared/inbound/mcp/json-schema.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { RegisterClusterHandler } from "@server/cluster/application/handlers/proxmox/register-cluster-handler.ts";
import { RegisterCluster } from "@server/cluster/application/commands/proxmox/register-cluster.ts";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";
import { slugSchema } from "@server/shared/inbound/mcp/json-schema-slug.ts";

type Args = {
  name: string;
  user?: string;
  hostname?: string;
};

/**
 * MCP endpoint `devstation_cluster_register` — registers a new cluster
 * in the catalog. MCP-port counterpart of `cluster.register`; consumes
 * the same handler.
 *
 * Mutating; policy guard uses the new cluster name from args (there is no
 * existing cluster to look up — register creates it).
 */
export class RegisterClusterMcpEndpoint implements
  Endpoint<
    "devstation_cluster_register",
    Args,
    { clusterId: string; name: string }
  > {
  readonly name = "devstation_cluster_register" as const;
  readonly title = "Register cluster";
  readonly description = "Registers a new cluster in the catalog. The cluster id is " +
    "generated server-side. Policy enforced via the new cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema: JsonSchema = {
    type: "object",
    properties: {
      name: slugSchema({
        description: "Cluster name. Lowercase slug — letters, digits and hyphens only " +
          "(must start and end with a letter or digit). Max 64 chars.",
      }),
      user: {
        type: "string",
        description: "Optional — defaults to the OS user running the engine.",
      },
      hostname: {
        type: "string",
        description: "Optional — defaults to the engine host's name.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  };

  constructor(private readonly handler: RegisterClusterHandler) {}

  async dispatch(
    args: Args,
    ctx: DispatchContext,
  ): Promise<{ clusterId: string; name: string }> {
    ctx.policy.requireMutableCluster(args.name);
    const actor = resolveActor(args);
    // Return the server-generated id so the LLM agent can chain follow-up
    // tools (cluster_get, cluster_connect) without an intermediate
    // cluster_list to find what it just created.
    const { clusterId } = await this.handler.handle(
      new RegisterCluster(args.name, actor.user, actor.hostname),
    );
    return { clusterId, name: args.name };
  }
}
