import { assertEquals } from "@std/assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * `devstation mcp serve` subcommand starts the same MCP port as the
 * standalone `src/mcp.ts` entry and answers a public method end-to-end.
 * This is the regression net for the subcommand routing — in particular
 * it asserts the stdout stream isn't polluted by any TTY trick (the
 * UI's alt-screen mustn't fire for `mcp serve`); any stray byte would
 * make initialize/handshake fail to parse.
 *
 * Bare `Deno.test`: same reasoning as subprocess.test.ts (npm SDK
 * keeps internal timers; subprocess sanitizers don't apply here).
 */
Deno.test({
  name: "`devstation-server mcp serve` serves initialize / tools.list / tools.call(rpc_version)",
  sanitizeOps: false,
  sanitizeResources: false,
  sanitizeExit: false,
  async fn() {
    /* @Given the `devstation-server mcp serve` subcommand spawned over stdio */
    const home = Deno.makeTempDirSync();
    const transport = new StdioClientTransport({
      command: Deno.execPath(),
      args: ["run", "-A", "server/bin/devstation-server", "mcp", "serve"],
      cwd: Deno.cwd(),
      env: { ...Deno.env.toObject(), DEVSTATION_HOME: home },
      stderr: "ignore",
    });
    const client = new Client({ name: "mcp-cli-test", version: "0.0.0" }, {
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
      assertEquals(typeof payload.protocol, "string");
      assertEquals(typeof payload.core, "string");
    } finally {
      await client.close().catch(() => {});
      await Deno.remove(home, { recursive: true }).catch(() => {});
    }
  },
});
