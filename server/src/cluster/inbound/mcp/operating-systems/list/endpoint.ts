import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllOperatingSystemsQuery } from "@server/cluster/application/queries/operating-systems/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_operating_systems_list` — operating
 * systems supported by cluster images. Authoritative read;
 * the UI / agent must not hardcode this list.
 */
export class ListOperatingSystemsMcpEndpoint implements
  Endpoint<
    "devstation_cluster_operating_systems_list",
    Record<string, never>,
    readonly string[]
  > {
  readonly name = "devstation_cluster_operating_systems_list" as const;
  readonly title = "List supported operating systems";
  readonly description = "Operating systems supported by cluster images.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly query: AllOperatingSystemsQuery) {}

  dispatch(): Promise<readonly string[]> {
    return this.query.execute();
  }
}
