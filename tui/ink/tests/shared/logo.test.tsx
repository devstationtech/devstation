/// <reference types="@types/react" />
import { assertStringIncludes } from "@std/assert";
import { render } from "ink-testing-library";
import { Logo } from "@ui/shared/logo.tsx";

Deno.test("Logo", async (t) => {
  await t.step("should render the ASCII logo lines", () => {
    /* @Given the Logo component */
    const { lastFrame, unmount } = render(<Logo />);

    /* @When the frame is captured */
    const frame = lastFrame() ?? "";

    /* @Then the logo should contain the distinctive ASCII art characters */
    assertStringIncludes(frame, "▞▀▌");
    assertStringIncludes(frame, "▝▀▘");

    unmount();
  });

  await t.step("should render across multiple lines", () => {
    /* @Given the Logo component */
    const { lastFrame, unmount } = render(<Logo />);

    /* @When the frame is captured and split by newlines */
    const frame = lastFrame() ?? "";
    const lines = frame.split("\n").filter((line) => line.trim().length > 0);

    /* @Then at least 4 lines of ASCII art should be present */
    if (lines.length < 4) {
      throw new Error(`Expected at least 4 non-empty lines, got ${lines.length}`);
    }

    unmount();
  });
});
