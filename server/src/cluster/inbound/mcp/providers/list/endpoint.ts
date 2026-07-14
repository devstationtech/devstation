import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllProvidersQuery } from "@server/cluster/application/queries/providers/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_providers_list` — available cluster
 * providers. Authoritative read; the UI / agent must not
 * hardcode this list.
 */
export class ListProvidersMcpEndpoint implements
  Endpoint<
    "devstation_cluster_providers_list",
    Record<string, never>,
    readonly string[]
  > {
  readonly name = "devstation_cluster_providers_list" as const;
  readonly title = "List cluster providers";
  readonly description = "Available cluster providers (kinds of infrastructure backend).";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly query: AllProvidersQuery) {}

  dispatch(): Promise<readonly string[]> {
    return this.query.execute();
  }
}
