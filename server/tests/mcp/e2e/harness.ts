/**
 * describe/it setup for live MCP e2e tests. `mcp()` spawns the real MCP
 * server (from source) once per `describe` and hands tests a client to
 * orchestrate directly — so an e2e test reads like any other test:
 * gherkin comments over plain client calls + `@std/assert`.
 *
 * These `*.mcptest.ts` files are NOT picked up by `deno test` (it only
 * matches `*.test.ts`); run them on demand via the `mcp:e2e:*` tasks.
 */
import { afterAll, beforeAll } from "@std/testing/bdd";
import { McpClient } from "@mcp-test-harness-ts/mod.ts";

/**
 * How to spawn the DevStation MCP server. `DEVSTATION_MCP_CMD` overrides;
 * default runs from source with `--unsafely-ignore-certificate-errors`
 * (the lab Proxmox uses a self-signed cert).
 */
export function devstationServerCmd(): string[] {
  const override = Deno.env.get("DEVSTATION_MCP_CMD");
  if (override) return override.split(/\s+/).filter((s) => s.length > 0);
  return [
    "deno",
    "run",
    "-A",
    "--unsafely-ignore-certificate-errors",
    "server/bin/devstation-server",
    "mcp",
    "serve",
  ];
}

/**
 * Registers `beforeAll`/`afterAll` on the enclosing `describe` to spawn and
 * close one MCP server+client, and returns a getter for the client.
 * The server self-loads its scoped token from
 * `~/.devstation/mcp/token.json`; without it the port boots read-only.
 *
 * ```ts
 * describe("Vault management", () => {
 *   const client = mcp();
 *   it("…", async () => { await client().parsed("devstation_vault_create", { name }); });
 * });
 * ```
 */
export function mcp(): () => McpClient {
  let client: McpClient | undefined;
  beforeAll(async () => {
    client = await McpClient.spawn({ serverCmd: devstationServerCmd() });
  });
  afterAll(async () => {
    await client?.close();
  });
  return () => {
    if (!client) throw new Error("mcp client not ready — used outside an it() after beforeAll");
    return client;
  };
}
