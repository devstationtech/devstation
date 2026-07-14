/// <reference types="@types/react" />
import { assertEquals, assertStringIncludes } from "@std/assert";
import { render } from "ink-testing-library";
import { HelpBar } from "@ui/shared/help-bar.tsx";

Deno.test("HelpBar", async (t) => {
  await t.step("should render the provided text", () => {
    /* @Given a HelpBar instance with help text */
    const { lastFrame, unmount } = render(<HelpBar>Press q to quit</HelpBar>);

    /* @When the frame is captured */
    const frame = lastFrame() ?? "";

    /* @Then the text should appear in the output */
    assertStringIncludes(frame, "Press q to quit");

    unmount();
  });

  await t.step("should render with empty text gracefully", () => {
    /* @Given a HelpBar with an empty string */
    // deno-lint-ignore jsx-curly-braces -- {""} passes the required empty-string child; the autofix drops it
    const { lastFrame, unmount } = render(<HelpBar>{""}</HelpBar>);

    /* @When the frame is captured */
    const frame = lastFrame();

    /* @Then the output should be defined (even if empty) */
    assertEquals(typeof frame, "string");

    unmount();
  });
});
