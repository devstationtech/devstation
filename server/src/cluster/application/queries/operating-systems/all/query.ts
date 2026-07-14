import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";

/**
 * Operating systems supported by cluster images (today: ubuntu-22-04,
 * ubuntu-24-04, debian-12). The OperatingSystem VO is the source of
 * truth; this query exposes its enumerated values on the read-side so
 * the image form picker consumes them via JSON-RPC/MCP instead of
 * importing the VO directly (zero coupling).
 */
export class Query {
  execute(): Promise<readonly string[]> {
    return Promise.resolve(OperatingSystem.values());
  }
}
