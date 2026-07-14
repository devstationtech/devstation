# @mcp-test-harness

A minimal, reusable client for driving any MCP stdio server from a test. Project-agnostic — it knows
nothing about a specific server or its tools.

```ts
import { McpClient } from "@mcp-test-harness-ts/mod.ts";

const client = await McpClient.spawn({ serverCmd: ["my-mcp-server", "serve"] });
try {
  const result = await client.parsed("some_tool", { arg: 1 }); // throws on isError
  const raw = await client.call("some_tool", { arg: 1 }); // { isError, text }
  const doc = await client.readResource("my://resource"); // resources/read text
} finally {
  await client.close();
}
```

That's the whole surface: spawn the server, `call`/`parsed`/`readResource`, `close`. Tests
orchestrate it directly (e.g. `describe/it` + `@std/assert`) — there's no scenario DSL or bundled
reporting; use your test runner's reporter (`deno test --junit-path=…`).

DevStation's live e2e tests live in `server/tests/mcp/e2e/**/*.mcptest.ts` and use this client via a
small `mcp()` setup helper.
