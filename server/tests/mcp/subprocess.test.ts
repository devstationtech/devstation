import { assertEquals } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Smoke test: the MCP SDK actually runs under Deno at runtime (not just
 * type-checks) and the per-BC endpoint registry answers a public method
 * end-to-end via the real `server/src/mcp.ts` entry.
 *
 * Bare `Deno.test` (not bdd describe/it): this spawns a real deno
 * child + the third-party MCP SDK whose stdio transport keeps
 * non-deterministic internal timers. The op/resource/exit sanitizers
 * are scoped here — a subprocess integration test legitimately can't
 * satisfy them (the leak lives in the npm SDK, not our code).
 */
Deno.test({
  name: "server/src/mcp.ts serves initialize / tools.list / tools.call(rpc_version)",
  sanitizeOps: false,
  sanitizeResources: false,
  sanitizeExit: false,
  async fn() {
    /* @Given the real `server/src/mcp.ts` entry spawned over stdio */
    const home = Deno.makeTempDirSync();
    const transport = new StdioClientTransport({
      command: Deno.execPath(),
      args: ["run", "-A", "server/src/mcp.ts"],
      cwd: Deno.cwd(),
      env: { ...Deno.env.toObject(), DEVSTATION_HOME: home },
      stderr: "ignore",
    });
    const client = new Client({ name: "mcp-subprocess-test", version: "0.0.0" }, {
      capabilities: {},
    });
    try {
      /* @When the client connects, lists tools, and calls rpc_version */
      await client.connect(transport);

      const tools = await client.listTools();
      const names = tools.tools.map((t: { name: string }) => t.name);
      assertEquals(names.includes("devstation_rpc_version"), true);

      const res = await client.callTool({
        name: "devstation_rpc_version",
        arguments: {},
      }) as { isError?: boolean; content: Array<{ type: string; text: string }> };
      /* @Then the tool is exposed and answers with a protocol/core handshake */
      assertEquals(res.isError ?? false, false);
      const payload = JSON.parse(res.content[0].text);
      // rpc.version handshake → { protocol, core }
      assertEquals(typeof payload.protocol, "string");
      assertEquals(typeof payload.core, "string");
    } finally {
      await client.close().catch(() => {});
      await Deno.remove(home, { recursive: true }).catch(() => {});
    }
  },
});
