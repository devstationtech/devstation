/// <reference types="@types/react" />
import { assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { render } from "ink-testing-library";
import { UpdateScreen } from "@ui/self-update/update-screen.tsx";
import type { UpdateStatus } from "@ui/self-update/mod.ts";

const flush = () => new Promise((r) => setTimeout(r, 40));

describe("UpdateScreen", () => {
  it("shows the available version + install hint when an update exists", async () => {
    /* @Given a check resolving to an available update */
    const status: UpdateStatus = {
      kind: "available",
      latest: "9.9.9",
      manifest: { version: "9.9.9", tag: "v9.9.9", assets: {} },
    };
    /* @When the screen is rendered and the check settles */
    const { lastFrame, unmount } = render(
      <UpdateScreen onBack={() => {}} check={() => Promise.resolve(status)} />,
    );
    await flush();
    /* @Then the frame shows the version and an install hint */
    assertStringIncludes(lastFrame() ?? "", "9.9.9");
    assertStringIncludes(lastFrame() ?? "", "install");
    unmount();
  });

  it("reports up-to-date when current", async () => {
    /* @When the screen is rendered with a current check */
    const { lastFrame, unmount } = render(
      <UpdateScreen onBack={() => {}} check={() => Promise.resolve({ kind: "current" })} />,
    );
    await flush();
    /* @Then the frame reports the user is up to date */
    assertStringIncludes(lastFrame() ?? "", "latest version");
    unmount();
  });

  it("surfaces a friendly message when the check is unknown", async () => {
    /* @When the screen is rendered with an unknown check */
    const { lastFrame, unmount } = render(
      <UpdateScreen onBack={() => {}} check={() => Promise.resolve({ kind: "unknown" })} />,
    );
    await flush();
    /* @Then the frame shows a friendly could-not-reach message */
    assertStringIncludes(lastFrame() ?? "", "could not reach");
    unmount();
  });
});
