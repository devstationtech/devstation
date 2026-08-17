/// <reference types="@types/react" />
import { assertEquals, assertStringIncludes } from "@std/assert";
import { render } from "ink-testing-library";
import { Table } from "@ui/shared/design-system/mod.ts";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `secret-${i + 1}` }));

Deno.test("Table", async (t) => {
  await t.step("should truncate cells beyond maxWidth with an ellipsis", () => {
    /* @Given a row whose name exceeds the column's maxWidth */
    const { lastFrame, unmount } = render(
      <Table
        rows={[{ name: "a-very-long-secret-name-that-overflows" }]}
        columns={[{ key: "name", maxWidth: 12 }]}
      />,
    );

    /* @Then the cell is capped at maxWidth and ends with … */
    assertStringIncludes(lastFrame() ?? "", "a-very-long…");
    assertEquals((lastFrame() ?? "").includes("overflows"), false);

    unmount();
  });

  await t.step("should render every row when no limit is set", () => {
    /* @Given 12 rows and no limit */
    const { lastFrame, unmount } = render(<Table rows={rows(12)} columns={["name"]} />);

    /* @Then all rows are visible and no overflow indicator is shown */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "secret-1");
    assertStringIncludes(frame, "secret-12");
    assertEquals(frame.includes("more"), false);

    unmount();
  });

  await t.step("should window rows to the limit with a ▼ overflow indicator", () => {
    /* @Given 21 rows, a limit of 10, and focus at the top */
    const { lastFrame, unmount } = render(
      <Table rows={rows(21)} columns={["name"]} focusedIndex={0} limit={10} />,
    );

    /* @Then only the first window renders, with the hidden tail counted */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "secret-1");
    assertStringIncludes(frame, "secret-10");
    assertEquals(frame.includes("secret-11\n"), false);
    assertStringIncludes(frame, "▼ 11 more");
    assertEquals(frame.includes("▲"), false);

    unmount();
  });

  await t.step("should keep the focused row visible when it is deep in the list", () => {
    /* @Given 21 rows with the focus past the first window */
    const { lastFrame, unmount } = render(
      <Table rows={rows(21)} columns={["name"]} focusedIndex={15} limit={10} />,
    );

    /* @Then the window is centered on the focused row, with both indicators */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "❯ secret-16");
    assertStringIncludes(frame, "▲ 10 more");
    assertStringIncludes(frame, "▼ 1 more");

    unmount();
  });

  await t.step("should size an auto viewport from the terminal height", () => {
    /* @Given 40 rows with limit="auto" (test terminal falls back to 30 rows,
       minus the 16 reserved for the standard screen chrome → 14 visible) */
    const { lastFrame, unmount } = render(
      <Table rows={rows(40)} columns={["name"]} focusedIndex={0} limit="auto" />,
    );

    /* @Then the viewport holds 14 rows and counts the hidden tail */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "secret-14");
    assertEquals(frame.includes("secret-15\n"), false);
    assertStringIncludes(frame, "▼ 26 more");

    unmount();
  });

  await t.step("should fit column widths to the terminal so rows never wrap", () => {
    /* @Given three columns whose natural widths (3×60) far exceed the
       100-col test terminal */
    const wide = "w".repeat(60);
    const { lastFrame, unmount } = render(
      <Table
        rows={[{ a: wide, b: wide, c: wide }]}
        columns={["a", "b", "c"]}
      />,
    );

    /* @Then every rendered line stays within the terminal width (no ink
       wrapping → no shattered layout) and cells are truncated */
    const frame = lastFrame() ?? "";
    const lines = frame.split("\n");
    assertEquals(lines.length, 3); // header, separator, one row — no wrap
    for (const line of lines) assertEquals(line.length <= 100, true);
    assertStringIncludes(frame, "…");

    unmount();
  });

  await t.step("should grow a capped column into leftover width on wide terminals", () => {
    /* @Given a description-style column capped at 10 but with 30 chars of
       content, on a 100-col terminal with plenty of leftover width */
    const content = "x".repeat(30);
    const { lastFrame, unmount } = render(
      <Table
        rows={[{ name: "short", description: content }]}
        columns={[{ key: "name" }, { key: "description", maxWidth: 10, grow: true }]}
      />,
    );

    /* @Then the column grows past its cap and shows the full content */
    assertStringIncludes(lastFrame() ?? "", content);

    unmount();
  });

  await t.step("should clamp the window at the end of the list", () => {
    /* @Given the last row focused */
    const { lastFrame, unmount } = render(
      <Table rows={rows(21)} columns={["name"]} focusedIndex={20} limit={10} />,
    );

    /* @Then the window sticks to the tail and only ▲ remains */
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "❯ secret-21");
    assertStringIncludes(frame, "▲ 11 more");
    assertEquals(frame.includes("▼"), false);

    unmount();
  });
});
