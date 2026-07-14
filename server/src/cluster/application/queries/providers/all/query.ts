import { Provider } from "@server/shared/building-blocks/domain/models/value-objects/provider.ts";

/**
 * Available cluster providers — the kinds of infrastructure backend a
 * cluster can run on (today: proxmox). The Provider enum in the
 * size domain is the source of truth; this query exposes it on
 * the read-side so UI pickers consume it via JSON-RPC/MCP instead of
 * importing the enum directly (zero coupling).
 */
export class Query {
  execute(): Promise<readonly string[]> {
    return Promise.resolve(Object.values(Provider));
  }
}
