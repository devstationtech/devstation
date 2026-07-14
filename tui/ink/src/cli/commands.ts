import React from "react";
import { Command } from "@cliffy/command";
import { render } from "ink";
import { App } from "@ui/app.tsx";
import { VERSION } from "@ui/cli/version.ts";
import { installMcp } from "@ui/cli/mcp-install.ts";
import { registerBlueprint } from "@ui/cli/blueprint-register.ts";
import { installShutdownHandlers } from "@ui/cli/signals.ts";
import { resolveEngineCommand } from "@ui/embedded-server.ts";
import { detectTheme } from "@ui/shared/theme/detect.ts";
import { applyStagedUpdate } from "@ui/self-update/boot-applier.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { terminal, process } = denoRuntime;

const writeSync = (s: string) => terminal.writeStdoutSync(new TextEncoder().encode(s));
const setTitle = (title: string) => writeSync(`\x1b]0;${title}\x07`);
// Run in the terminal's alternate screen buffer (same trick vim/htop/less use)
// so the interactive UI doesn't pollute scrollback with every redraw.
const enterAltScreen = () => writeSync("\x1b[?1049h");
const exitAltScreen = () => writeSync("\x1b[?1049l");
// OSC 11 paints the terminal background colour; OSC 111 restores the
// terminal's configured default. Pairs with `enterAltScreen`/`exitAltScreen`
// so the override is scoped to the TUI session — exiting drops back into
// the user's normal terminal theme intact.
const paintTerminalBg = (hex: string) => writeSync(`\x1b]11;${hex}\x07`);
const resetTerminalBg = () => writeSync("\x1b]111\x07");

const run = async () => {
  // Apply a staged update (Windows) before anything else — it swaps the
  // on-disk binary while nothing locks it yet. No-op on POSIX and when
  // there's no pending update; never throws (boot must not depend on it).
  const applied = await applyStagedUpdate();
  if (applied) {
    writeSync(`${applied}\n`);
    process.exit(0);
  }

  // Detection has to happen BEFORE Ink takes over stdin/stdout — the
  // OSC 11 background-color query (auto mode only) needs raw stdin
  // briefly to read the terminal's reply. After Ink mounts, stdin
  // belongs to Ink.
  const theme = await detectTheme();

  setTitle("< devstation >");
  enterAltScreen();
  if (theme.forceDark) {
    // Paint the terminal bg dark so the TUI looks identical on
    // Terminal.app/Warp/iTerm2/etc regardless of the user's theme.
    // Inverse highlight bars, chips and dim text are tuned against a
    // dark backdrop — without the repaint, a light-themed terminal
    // would render `inverse` rows as harsh black bars and faded text
    // as near-invisible grey.
    paintTerminalBg(theme.forcedBackground);
  }

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    // Restore the terminal bg BEFORE leaving the alt screen so the
    // reset reaches the right buffer (some terminals scope colour
    // changes per-buffer; doing it after the swap can be lost).
    if (theme.forceDark) resetTerminalBg();
    exitAltScreen();
    setTitle("");
  };
  installShutdownHandlers(restore);

  try {
    const { waitUntilExit } = render(React.createElement(App), { exitOnCtrlC: false });
    await waitUntilExit();
  } finally {
    restore();
  }
};

export const command = new Command()
  .name("devstation")
  .version(VERSION)
  .description("DevStation CLI")
  .action(run)
  .command("cluster", new Command().description("Manage clusters").action(run))
  .command(
    "mcp",
    new Command()
      .description(
        "MCP (Model Context Protocol) tooling. `serve` boots the engine " +
          "over stdio for an MCP client to spawn; `install` registers the " +
          "command with the user's AI client.",
      )
      .command(
        "serve",
        new Command()
          .description(
            "Boot the embedded engine in MCP stdio mode. Designed to be " +
              "spawned by an MCP client (Claude Desktop, Cursor, etc.) — " +
              "the `mcp install` subcommand wires this command into their " +
              "configs. Does not import the engine at compile time: it " +
              "extracts the bundled engine binary on first run and re-execs " +
              "it with `mcp serve` as args (layers preserved — UI source " +
              "knows the engine as bytes, not as code).",
          )
          .action(async () => {
            const engine = await resolveEngineCommand();
            const code = await process.spawnInherit(engine.command, [
              ...engine.args,
              "mcp",
              "serve",
            ]);
            process.exit(code);
          }),
      )
      .command(
        "install",
        new Command()
          .description(
            "Register the DevStation MCP server with your AI client. " +
              "Automates Claude Code; prints a paste-in snippet for others.",
          )
          .option("--print", "Print the config snippet only — register nothing.")
          .action(async (opts: { print?: boolean }) => {
            process.exit(await installMcp({ print: opts.print }));
          }),
      ),
  )
  .command(
    "blueprint",
    new Command()
      .description(
        "Author your own blueprints. `register` validates a blueprint with " +
          "the engine parser and installs it into ~/.devstation/blueprints, " +
          "where it is merged with the bundled catalog (yours wins on a " +
          "name collision).",
      )
      .command(
        "register",
        new Command()
          .description(
            "Validate and install a blueprint (a directory or a blueprint.yaml) " +
              "into ~/.devstation/blueprints/<name>. Refuses to shadow an " +
              "existing blueprint unless --force is given.",
          )
          .arguments("<path:string>")
          .option("-f, --force", "Override an existing blueprint of the same name.")
          .action(async (opts: { force?: boolean }, path: string) => {
            const result = await registerBlueprint(path, { force: opts.force });
            (result.ok ? console.log : console.error)(result.message);
            process.exit(result.ok ? 0 : 1);
          }),
      ),
  );
