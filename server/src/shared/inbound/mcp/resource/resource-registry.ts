import type { Resource } from "@server/shared/inbound/mcp/resource/resource.ts";

/**
 * Wire-level payload returned by the MCP SDK's `resources/read` callback.
 * One entry per resource; multiple is reserved for future templated
 * resources (per-id slices, etc.).
 */
export interface ResourceReadResult {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}

/**
 * Routes `devstation://…` URIs to their `Resource` implementations.
 * Parallel to `endpoint/EndpointRegistry` but read-only (no policy
 * guard, no error wrapping — resources are queries; an unknown URI
 * throws an `Error` that the SDK surfaces to the caller).
 */
export class ResourceRegistry {
  private readonly entries = new Map<string, Resource>();

  static empty(): ResourceRegistry {
    return new ResourceRegistry();
  }

  private constructor() {}

  register(resource: Resource): this {
    if (this.entries.has(resource.uri)) {
      throw new Error(`duplicate MCP resource: ${resource.uri}`);
    }
    this.entries.set(resource.uri, resource);
    return this;
  }

  list(): Array<{ uri: string; name: string; description: string }> {
    return [...this.entries.values()].map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
    }));
  }

  async read(uri: string): Promise<ResourceReadResult> {
    const resource = this.entries.get(uri);
    if (!resource) throw new Error(`unknown resource: ${uri}`);
    const data = await resource.read();
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
    };
  }
}
