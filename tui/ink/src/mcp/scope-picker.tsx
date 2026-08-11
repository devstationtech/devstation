/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { colors } from "@ui/shared/design-system/tokens.ts";
import { ALL_SCOPE_OPTIONS, MCP_SCOPE_GROUPS, type ScopeOption } from "@ui/mcp/scope-catalog.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  /** Scopes currently checked. */
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (scope: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
};

/**
 * One rendered line of the picker. The grouped catalogue is flattened to
 * lines so the list can be windowed to the terminal height: without a
 * viewport the ~30-line list overflows the fixed-height `ScreenFrame`,
 * and Ink drops/overlays arbitrary rows (group headers, `read` scopes),
 * shifting as the cursor moves.
 */
type Line =
  | { readonly kind: "header"; readonly label: string }
  | { readonly kind: "scope"; readonly option: ScopeOption; readonly index: number }
  | { readonly kind: "spacer"; readonly after: string };

const LINES: readonly Line[] = (() => {
  const lines: Line[] = [];
  let index = 0;
  MCP_SCOPE_GROUPS.forEach((group, g) => {
    lines.push({ kind: "header", label: group.label });
    for (const option of group.scopes) {
      lines.push({ kind: "scope", option, index: index++ });
    }
    if (g < MCP_SCOPE_GROUPS.length - 1) lines.push({ kind: "spacer", after: group.label });
  });
  return lines;
})();

/** Line position of the scope at `index` within the flattened list. */
const lineOfScope = (index: number): number =>
  LINES.findIndex((l) => l.kind === "scope" && l.index === index);

// Vertical chrome around the list when the picker is on screen: screen
// padding, logo card, box borders, the hint paragraph and the help bar.
const CHROME_LINES = 18;
const MIN_VIEW_LINES = 6;

/**
 * Grouped checkbox list for picking the scopes an MCP token will grant.
 *
 * Up/down moves the cursor across the flat list of scopes (group labels
 * are headers, not stops); space toggles; enter confirms; esc cancels.
 * The list is windowed to the terminal height — `▲/▼ n more` markers show
 * how many scopes are scrolled out of view.
 */
export function ScopePicker({ selected, onToggle, onSubmit, onCancel }: Props) {
  const [cursor, setCursor] = useState(0);
  const last = ALL_SCOPE_OPTIONS.length - 1;
  const { stdout } = useStdout();
  const maxLines = Math.max(MIN_VIEW_LINES, (stdout.rows ?? 30) - CHROME_LINES);

  useInput((char, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(last, c + 1));
      return;
    }
    if (char === " ") {
      onToggle(ALL_SCOPE_OPTIONS[cursor].scope);
      return;
    }
    if (key.return) {
      onSubmit();
      return;
    }
  });

  // Window the flattened lines around the cursor. Markers take one line
  // each, so the slice budget shrinks when the list is clipped.
  const total = LINES.length;
  const clipped = total > maxLines;
  const view = clipped ? Math.max(1, maxLines - 2) : total;
  const cursorLine = lineOfScope(cursor);
  let start = Math.max(0, Math.min(total - view, cursorLine - Math.floor(view / 2)));
  // Keep a group header attached to its first scope at the window edge.
  if (start > 0 && LINES[start].kind === "scope" && LINES[start - 1].kind === "header") {
    start -= 1;
  }
  const end = Math.min(total, start + view);
  const hiddenAbove = LINES.slice(0, start).filter((l) => l.kind === "scope").length;
  const hiddenBelow = LINES.slice(end).filter((l) => l.kind === "scope").length;

  return (
    <Box flexDirection="column">
      {clipped && <DimText>{hiddenAbove > 0 ? `▲ ${hiddenAbove} more` : " "}</DimText>}
      {LINES.slice(start, end).map((line) => {
        if (line.kind === "header") {
          return <Text key={`h:${line.label}`} bold color={colors.primary}>{line.label}</Text>;
        }
        if (line.kind === "spacer") {
          return <Box key={`s:${line.after}`} height={1} />;
        }
        const isCursor = line.index === cursor;
        const isChecked = selected.has(line.option.scope);
        const tint = isCursor ? colors.accent : undefined;
        return (
          <Box key={line.option.scope}>
            <Text color={tint}>{isCursor ? "❯ " : "  "}</Text>
            <Text color={isChecked ? colors.success : tint}>
              {isChecked ? "[x] " : "[ ] "}
            </Text>
            <Text color={tint} bold={isCursor}>{line.option.label.padEnd(18)}</Text>
            <DimText>{line.option.description}</DimText>
          </Box>
        );
      })}
      {clipped && <DimText>{hiddenBelow > 0 ? `▼ ${hiddenBelow} more` : " "}</DimText>}
    </Box>
  );
}
