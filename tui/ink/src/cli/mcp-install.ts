/**
 * `devstation mcp install` — registers the DevStation MCP server with
 * the user's AI client(s).
 *
 * An MCP server is spawned by the *client* (Claude Code, Claude
 * Desktop, Cursor, …); each client keeps its own registry in its own
 * config file — there is no shared location DevStation could own. So
 * "exposing the MCP port" means writing a `devstation` entry into
 * whatever client the user runs.
 *
 * v1 automates Claude Code (via its `claude` CLI) and prints a
 * copy-paste snippet for every other client.
 */
import { join } from "@std/path";
import { defaultDevstationHome, userHome } from "@ui/cli/paths.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env, process } = denoRuntime;

/** The `mcpServers` entry every MCP client expects for DevStation. */
export const DEVSTATION_MCP_ENTRY = {
  command: "devstation",
  args: ["mcp", "serve"],
} as const;

/** Pretty `mcpServers` snippet for manual paste into a client config. */
export function configSnippet(): string {
  return JSON.stringify({ mcpServers: { devstation: DEVSTATION_MCP_ENTRY } }, null, 2);
}

/** Path of the token file the MCP server self-loads. */
export function tokenPath(): string {
  const home = env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
  return join(home, "mcp", "token.json");
}

/**
 * Seam over the Claude Code `claude` CLI — the real implementation
 * shells out; tests inject a fake. Keeps `installMcp` free of
 * subprocess wiring so its branching is unit-testable.
 */
export interface ClaudeCli {
  /** True when the `claude` binary is on PATH. */
  available(): Promise<boolean>;
  /** Registers the `devstation` server at user scope. */
  register(): Promise<{ ok: boolean; message: string }>;
}

/**
 * Resolves the Claude Code CLI executable on this system.
 *
 *  1. PATH lookup — covers Mac/Linux installs and Windows installs
 *     where the user added Claude Code's bin dir to PATH manually.
 *  2. Windows-only fallback: Claude Desktop bundles a full Claude
 *     Code CLI at `%APPDATA%\Claude\claude-code\<version>\claude.exe`
 *     but does NOT put it on PATH. Without this fallback,
 *     `devstation mcp install` reported "Claude not found" even on
 *     machines with Claude Desktop installed, and printed the manual
 *     snippet instead of auto-registering. The bundled CLI accepts
 *     the same `mcp add` args.
 *
 * Returns `null` when no CLI is reachable; caller falls back to the
 * manual snippet flow.
 */
export async function findClaudeCli(): Promise<string | null> {
  const onPath = await whichClaudeOnPath();
  if (onPath) return onPath;
  if (env.os === "windows") {
    return findBundledClaudeOnWindows();
  }
  return null;
}

async function whichClaudeOnPath(): Promise<string | null> {
  for (const candidate of ["claude", "claude.exe"]) {
    try {
      const { success } = await process.run(candidate, ["--version"]);
      if (success) return candidate;
    } catch {
      // fall through
    }
  }
  return null;
}

function findBundledClaudeOnWindows(): string | null {
  const appData = env.get("APPDATA") ?? join(userHome(), "AppData", "Roaming");
  const base = join(appData, "Claude", "claude-code");
  let versions: string[];
  try {
    versions = fs.readDirSync(base)
      .filter((e) => e.isDirectory)
      .map((e) => e.name)
      .sort(compareSemverDesc);
  } catch {
    return null;
  }
  for (const v of versions) {
    const bin = join(base, v, "claude.exe");
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

/**
 * Newest-first comparator for version directory names. Non-semver
 * names (e.g. "latest") sort to the end so semver candidates are
 * preferred. Falls back to string compare when components match.
 */
function compareSemverDesc(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa && pb) {
    for (let i = 0; i < 3; i++) {
      const diff = pb[i] - pa[i];
      if (diff !== 0) return diff;
    }
    return b.localeCompare(a);
  }
  if (pa) return -1;
  if (pb) return 1;
  return b.localeCompare(a);
}

function parseSemver(name: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(name);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export const realClaudeCli: ClaudeCli = {
  async available(): Promise<boolean> {
    return (await findClaudeCli()) !== null;
  },
  async register(): Promise<{ ok: boolean; message: string }> {
    const claude = await findClaudeCli();
    if (!claude) {
      return { ok: false, message: "claude CLI not found on PATH or bundled location" };
    }
    try {
      const { success, stderr } = await process.run(claude, [
        "mcp",
        "add",
        "devstation",
        "--scope",
        "user",
        "--",
        "devstation",
        "mcp",
        "serve",
      ]);
      const message = new TextDecoder().decode(stderr).trim();
      return { ok: success, message };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  },
};

export interface InstallOptions {
  /** Print the snippet + instructions only — register nothing. */
  readonly print?: boolean;
}

export interface InstallIo {
  readonly out: (line: string) => void;
  readonly claude: ClaudeCli;
  readonly tokenExists: (path: string) => boolean;
}

const defaultIo: InstallIo = {
  out: (line) => console.log(line),
  claude: realClaudeCli,
  tokenExists: (path) => fs.existsSync(path),
};

const MANUAL = (snippet: string) =>
  `Add this to your MCP client's config (merge under "mcpServers"):\n\n${snippet}\n\n` +
  `  • Claude Desktop — claude_desktop_config.json\n` +
  `  • Cursor — ~/.cursor/mcp.json (or .cursor/mcp.json in a project)\n` +
  `Then restart the client.`;

/**
 * Registers the DevStation MCP server. Returns a process exit code.
 *
 *  - `--print`: emits the snippet + manual instructions, writes nothing.
 *  - otherwise: registers with Claude Code when its CLI is present;
 *    falls back to the manual snippet when it is not.
 */
export async function installMcp(
  opts: InstallOptions = {},
  io: InstallIo = defaultIo,
): Promise<number> {
  const snippet = configSnippet();

  if (!io.tokenExists(tokenPath())) {
    io.out(
      `⚠ No MCP token at ${tokenPath()} — the server will boot read-only.\n` +
        `  Run \`devstation\` → /mcp to mint one before (or after) installing.\n`,
    );
  }

  if (opts.print) {
    io.out(MANUAL(snippet));
    return 0;
  }

  if (await io.claude.available()) {
    const { ok, message } = await io.claude.register();
    if (ok) {
      io.out(
        "✓ Registered the `devstation` MCP server with Claude Code (user scope).\n" +
          "  Restart Claude Code to load it.",
      );
      return 0;
    }
    io.out(
      `✗ \`claude mcp add\` failed: ${message || "unknown error"}\n` +
        `  If it is already registered, remove it first: claude mcp remove devstation\n\n` +
        MANUAL(snippet),
    );
    return 1;
  }

  io.out(`Claude Code CLI not found on PATH.\n\n${MANUAL(snippet)}`);
  return 0;
}
