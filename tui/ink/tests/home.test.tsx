/// <reference types="@types/react" />
import { assert, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { HomeScreen, type Screen } from "@ui/home.tsx";
import type { UpdateStatus } from "@ui/self-update/mod.ts";

/**
 * Smoke tests for the HomeScreen — the main menu that routes to the top-level
 * areas (topologies, mcp). Update surfaces as a bottom notification + `U`
 * shortcut, not a menu item. Tests assert visible text/labels and navigation,
 * not ASCII layout, so cosmetic refactors don't break them.
 */

function setup(
  checkUpdate: () => Promise<UpdateStatus> = () => Promise.resolve({ kind: "current" }),
) {
  let lastNavigated: Screen | null = null;
  const onNavigate = (screen: Screen) => {
    lastNavigated = screen;
  };
  const result = render(<HomeScreen onNavigate={onNavigate} checkUpdate={checkUpdate} />);
  return { ...result, navigated: () => lastNavigated };
}

// Flush React/Ink state updates after a stdin.write — input handlers schedule
// state updates that React 18 batches; yield to the event loop a couple of
// ticks so the next frame reflects the new state.
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("HomeScreen — menu", () => {
  it("renders the two menu entries and the navigation hint", async () => {
    const { lastFrame, unmount } = setup();
    await flush();
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "topologies");
    assertStringIncludes(frame, "mcp");
    assertStringIncludes(frame, "↑↓ select");
    unmount();
  });

  it("opens topologies (first entry) on Enter", async () => {
    const { stdin, unmount, navigated } = setup();
    await flush();
    stdin.write("\r");
    await flush();
    assertStringIncludes(navigated() ?? "", "topologies");
    unmount();
  });

  it("moves the cursor down and opens mcp on Enter", async () => {
    const { stdin, unmount, navigated } = setup();
    await flush();
    stdin.write("[B"); // arrow down
    await flush();
    stdin.write("\r");
    await flush();
    assertStringIncludes(navigated() ?? "", "mcp");
    unmount();
  });
});

describe("HomeScreen — update notification", () => {
  const available: UpdateStatus = {
    kind: "available",
    latest: "1.4.2",
    // deno-lint-ignore no-explicit-any
    manifest: {} as any,
  };

  it("shows a bottom notification when a newer version exists", async () => {
    const { lastFrame, unmount } = setup(() => Promise.resolve(available));
    await flush();
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "New version 1.4.2 available");
    assertStringIncludes(frame, "press");
    assertStringIncludes(frame, "to update");
    unmount();
  });

  it("navigates to the updater when U is pressed and an update is available", async () => {
    const { stdin, unmount, navigated } = setup(() => Promise.resolve(available));
    await flush();
    stdin.write("U");
    await flush();
    assertStringIncludes(navigated() ?? "", "update");
    unmount();
  });

  it("hides the notification (and ignores U) when up to date", async () => {
    const { stdin, lastFrame, unmount, navigated } = setup(() =>
      Promise.resolve({ kind: "current" })
    );
    await flush();
    assert(!(lastFrame() ?? "").includes("New version"), "no notification when current");
    stdin.write("U");
    await flush();
    assert(navigated() === null, "U must do nothing when up to date");
    unmount();
  });
});
