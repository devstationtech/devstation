import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import {
  type ClaudeCli,
  configSnippet,
  findClaudeCli,
  type InstallIo,
  installMcp,
} from "@ui/cli/mcp-install.ts";

/**
 * `devstation mcp install` — registers the MCP server with the user's
 * AI client. Tests the branching against a faked Claude CLI seam;
 * no subprocess is spawned.
 */

function fakeIo(
  claude: ClaudeCli,
  tokenExists = true,
): { io: InstallIo; output: () => string } {
  const lines: string[] = [];
  return {
    io: { out: (l) => lines.push(l), claude, tokenExists: () => tokenExists },
    output: () => lines.join("\n"),
  };
}

const claudeAbsent: ClaudeCli = {
  available: () => Promise.resolve(false),
  register: () => Promise.resolve({ ok: false, message: "should not be called" }),
};

describe("configSnippet", () => {
  it("emits a valid mcpServers entry running `devstation mcp serve`", () => {
    const parsed = JSON.parse(configSnippet());
    // The MCP client invokes `devstation mcp serve`, which proxies
    // through the UI binary into the embedded engine via
    // `embedded-server.ts`.
    assertEquals(parsed.mcpServers.devstation.command, "devstation");
    assertEquals(parsed.mcpServers.devstation.args, ["mcp", "serve"]);
  });
});

describe("installMcp", () => {
  it("--print emits the manual snippet and never touches the Claude CLI", async () => {
    /* @Given Claude CLI that would throw if invoked */
    const claude: ClaudeCli = {
      available: () => Promise.reject(new Error("must not be called")),
      register: () => Promise.reject(new Error("must not be called")),
    };
    const { io, output } = fakeIo(claude);

    /* @When install runs in print mode */
    const code = await installMcp({ print: true }, io);

    /* @Then it prints the snippet + manual instructions, exit 0 */
    assertEquals(code, 0);
    assertStringIncludes(output(), '"mcpServers"');
    assertStringIncludes(output(), "Claude Desktop");
  });

  it("registers with Claude Code when its CLI is available", async () => {
    /* @Given a Claude CLI that registers successfully */
    let registered = false;
    const claude: ClaudeCli = {
      available: () => Promise.resolve(true),
      register: () => {
        registered = true;
        return Promise.resolve({ ok: true, message: "" });
      },
    };
    const { io, output } = fakeIo(claude);

    /* @When install runs */
    const code = await installMcp({}, io);

    /* @Then the server was registered and success is reported */
    assertEquals(registered, true);
    assertEquals(code, 0);
    assertStringIncludes(output(), "Registered");
    assertStringIncludes(output(), "Restart Claude Code");
  });

  it("falls back to the manual snippet when registration fails", async () => {
    /* @Given a Claude CLI whose add fails (e.g. already registered) */
    const claude: ClaudeCli = {
      available: () => Promise.resolve(true),
      register: () => Promise.resolve({ ok: false, message: "already exists" }),
    };
    const { io, output } = fakeIo(claude);

    /* @When install runs */
    const code = await installMcp({}, io);

    /* @Then it exits non-zero and shows the error + the manual snippet */
    assertEquals(code, 1);
    assertStringIncludes(output(), "already exists");
    assertStringIncludes(output(), '"mcpServers"');
  });

  it("prints the manual snippet when the Claude CLI is absent", async () => {
    /* @Given no Claude CLI on PATH */
    const { io, output } = fakeIo(claudeAbsent);

    /* @When install runs */
    const code = await installMcp({}, io);

    /* @Then it degrades to the paste-in snippet, exit 0 */
    assertEquals(code, 0);
    assertStringIncludes(output(), "Claude Code CLI not found");
    assertStringIncludes(output(), '"mcpServers"');
  });

  it("warns when no MCP token is configured", async () => {
    /* @Given no token on disk */
    const { io, output } = fakeIo(claudeAbsent, false);

    /* @When install runs */
    await installMcp({ print: true }, io);

    /* @Then the operator is told to mint one via /mcp */
    assertStringIncludes(output(), "No MCP token");
    assertStringIncludes(output(), "/mcp");
  });

  it("does not warn about the token when one is present", async () => {
    /* @Given a token on disk */
    const { io, output } = fakeIo(claudeAbsent, true);

    /* @When install runs */
    await installMcp({ print: true }, io);

    /* @Then no missing-token warning is shown */
    assertEquals(output().includes("No MCP token"), false);
  });
});

/**
 * Claude Desktop bundles a full Claude Code CLI at
 * `%APPDATA%\Claude\claude-code\<ver>\claude.exe` but doesn't put it
 * on PATH. Without the bundled-path fallback, `devstation mcp install`
 * reported "Claude not found" on every Windows install with Claude
 * Desktop even though the CLI was present.
 *
 * The Windows-bundled branch only fires when `Deno.build.os ===
 * 'windows'`, so on Linux/Mac CI we exercise the fallback by
 * skipping the test. The unit-testable parts are:
 *   - PATH-first preference (`claude` returns a non-null path)
 *   - Bundled lookup picks the highest semver dir
 *   - Returns null when nothing matches
 *
 * For the Windows-only directory walk we set $APPDATA to a tempdir
 * and create a fake `Claude\claude-code\<version>\claude.exe`
 * tree, then assert the resolver returns the highest version.
 */
describe("findClaudeCli — Windows-bundled fallback", () => {
  it("returns null when nothing is on PATH and nothing is bundled", async () => {
    const ogAppData = Deno.env.get("APPDATA");
    const ogPath = Deno.env.get("PATH");
    // Empty PATH → `claude` lookup fails; non-existent APPDATA dir →
    // bundled lookup fails too.
    Deno.env.set("PATH", "");
    Deno.env.set("APPDATA", "/definitely/not/a/real/path");
    try {
      assertEquals(await findClaudeCli(), null);
    } finally {
      if (ogPath !== undefined) Deno.env.set("PATH", ogPath);
      if (ogAppData === undefined) Deno.env.delete("APPDATA");
      else Deno.env.set("APPDATA", ogAppData);
    }
  });

  it("prefers PATH when `claude` resolves there", async () => {
    if (Deno.build.os === "windows") return; // shell name differs; PATH probe is OS-specific
    // On POSIX, fake a `claude` shim into a temp dir and prepend it to PATH.
    const dir = await Deno.makeTempDir({ prefix: "claude-shim-" });
    const shim = join(dir, "claude");
    await Deno.writeTextFile(shim, "#!/bin/sh\necho 'fake' ; exit 0\n");
    await Deno.chmod(shim, 0o755);
    const ogPath = Deno.env.get("PATH");
    Deno.env.set("PATH", `${dir}:${ogPath ?? ""}`);
    try {
      const found = await findClaudeCli();
      // Whatever the resolver returns, it must be a string that
      // `--version` succeeded against — `null` here would be the bug.
      assertEquals(typeof found, "string");
    } finally {
      if (ogPath !== undefined) Deno.env.set("PATH", ogPath);
      await Deno.remove(dir, { recursive: true });
    }
  });

  it("on Windows, picks the highest semver bundled CLI under %APPDATA%", async () => {
    if (Deno.build.os !== "windows") return; // walk only runs on Windows
    const dir = await Deno.makeTempDir({ prefix: "claude-bundled-" });
    const base = join(dir, "Claude", "claude-code");
    for (const v of ["2.0.99", "2.1.149", "2.1.10"]) {
      await Deno.mkdir(join(base, v), { recursive: true });
      await Deno.writeTextFile(join(base, v, "claude.exe"), "");
    }
    const ogAppData = Deno.env.get("APPDATA");
    const ogPath = Deno.env.get("PATH");
    Deno.env.set("APPDATA", dir);
    Deno.env.set("PATH", ""); // force the bundled branch
    try {
      const found = await findClaudeCli();
      assertEquals(found, join(base, "2.1.149", "claude.exe"));
    } finally {
      if (ogAppData === undefined) Deno.env.delete("APPDATA");
      else Deno.env.set("APPDATA", ogAppData);
      if (ogPath !== undefined) Deno.env.set("PATH", ogPath);
      await Deno.remove(dir, { recursive: true });
    }
  });
});
