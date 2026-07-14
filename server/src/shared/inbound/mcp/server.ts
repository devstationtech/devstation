import { Server as McpSdkServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import type { EndpointRegistry } from "@server/shared/inbound/mcp/endpoint/endpoint-registry.ts";
import type { ResourceRegistry } from "@server/shared/inbound/mcp/resource/resource-registry.ts";
import { prompts } from "@server/shared/inbound/mcp/prompts/registry.ts";
import { VERSION } from "@server/build-info.ts";
import { installShutdownHandlers } from "@server/shared/platform/signals.ts";

/**
 * MCP inbound adapter (feature port). Low-level SDK `Server` (plain
 * JSON-Schema tools, no zod authoring).
 *
 * This function only knows about the per-BC `EndpointRegistry` (tools)
 * and `ResourceRegistry` (resources). Every dispatch is handler-direct
 * from the per-BC inbound MCP adapter.
 */
const NAME = "devstation-mcp";

export function buildMcpServer(
  endpoints: EndpointRegistry,
  resources: ResourceRegistry,
  policy: McpPolicy,
): McpSdkServer {
  const dispatchCtx = { policy };
  const server = new McpSdkServer(
    { name: NAME, version: VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    () => Promise.resolve({ tools: endpoints.list() }),
  );

  server.setRequestHandler(CallToolRequestSchema, (
    req: { params: { name: string; arguments?: Record<string, unknown> } },
  ) => endpoints.call(req.params.name, req.params.arguments ?? {}, dispatchCtx));

  server.setRequestHandler(ListResourcesRequestSchema, () =>
    Promise.resolve({
      resources: resources.list().map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: "application/json",
      })),
    }));

  server.setRequestHandler(
    ReadResourceRequestSchema,
    (req: { params: { uri: string } }) => resources.read(req.params.uri),
  );

  server.setRequestHandler(ListPromptsRequestSchema, () =>
    Promise.resolve({
      prompts: prompts.map((p) => ({ name: p.name, description: p.description })),
    }));

  server.setRequestHandler(
    GetPromptRequestSchema,
    (req: { params: { name: string } }) => {
      const p = prompts.find((x) => x.name === req.params.name);
      if (!p) throw new Error(`unknown prompt: ${req.params.name}`);
      return Promise.resolve({
        description: p.description,
        messages: [{ role: "user", content: { type: "text", text: p.text } }],
      });
    },
  );

  return server;
}

/**
 * Runs a composed MCP server over stdio — the MCP-framework run
 * helper. Wires the stdio transport + SIGINT/SIGTERM and connects.
 * Symmetric with `shared/inbound/rpc/server.ts`'s `serveStdio`: the
 * composition root (`src/mcp.ts`) builds the server; the entry points
 * (`src/mcp-server.ts` and the `devstation mcp serve` subcommand) run
 * it through here.
 *
 * `banner` is written to stderr before connecting — stdout is the MCP
 * protocol channel and MUST stay clean.
 */
export async function serveStdio(server: McpSdkServer, banner: string): Promise<void> {
  console.error(banner);

  installShutdownHandlers(() => Deno.exit(0));

  await server.connect(new StdioServerTransport());
}
