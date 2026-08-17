/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";
import { table } from "@ui/shared/design-system/tokens.ts";
import { DimText, useTheme } from "@ui/shared/theme/mod.ts";

export type Row = Record<string, string | number>;

type Align = "left" | "right";

export type Column<T extends Row> = {
  key: keyof T;
  header?: string;
  align?: Align;
  // When true, this column's cell text keeps its original color even on
  // non-focused rows (used for status dots that already encode meaning via
  // color and would lose the signal if dimmed).
  bright?: boolean;
  /** Caps cell width and truncates with `…` when exceeded. Header is also capped. */
  maxWidth?: number;
  /**
   * On wide terminals, lets this column expand past `maxWidth` into leftover
   * width (up to its real content width). For long free-text columns
   * (descriptions) so wide screens are not wasted on a fixed cap.
   */
  grow?: boolean;
};

type Props<T extends Row> = {
  rows: T[];
  columns?: (keyof T)[] | Column<T>[];
  focusedIndex?: number;
  emptyMessage?: string;
  /**
   * Max rows rendered at once. Longer lists scroll inside a viewport kept
   * centered on `focusedIndex`, with `▲/▼ N more` overflow indicators.
   * `"auto"` sizes the viewport to the terminal height minus `reservedRows`,
   * re-measuring on resize.
   */
  limit?: number | "auto";
  /**
   * Terminal rows consumed by the chrome around the table when
   * `limit="auto"`: the default covers the standard list screen (outer
   * padding, header card, frame borders/padding, table header + separator,
   * overflow indicators, help bar).
   */
  reservedRows?: number;
  /**
   * Terminal columns consumed by the chrome left+right of the table: the
   * default covers the standard ScreenFrame (outer padding, box borders,
   * box paddingX). Rows are always fitted to the remaining width — a row
   * wider than the terminal would wrap and shatter the whole layout.
   */
  reservedCols?: number;
};

const DEFAULT_RESERVED_ROWS = 16;
const MIN_VIEW_ROWS = 5;
const FALLBACK_TERM_ROWS = 30;
const DEFAULT_RESERVED_COLS = 6;
const MIN_COL_WIDTH = 5;
const FALLBACK_TERM_COLS = 80;

/**
 * Shrinks column widths until the row fits the available width: repeatedly
 * takes one character from the widest column, so wide columns (descriptions)
 * give way first and narrow ones (dates, versions) keep their meaning. Floors
 * at MIN_COL_WIDTH — beyond that the terminal is too narrow to help.
 */
function fit(widths: number[], available: number): number[] {
  const fitted = [...widths];
  let sum = fitted.reduce((s, w) => s + w, 0);
  while (sum > available) {
    let widest = 0;
    for (let i = 1; i < fitted.length; i++) {
      if (fitted[i] > fitted[widest]) widest = i;
    }
    if (fitted[widest] <= MIN_COL_WIDTH) break;
    fitted[widest]--;
    sum--;
  }
  return fitted;
}

function normalizeColumns<T extends Row>(
  rows: T[],
  columns?: (keyof T)[] | Column<T>[],
): Column<T>[] {
  if (columns === undefined) {
    return (Object.keys(rows[0]) as (keyof T)[]).map((key) => ({ key }));
  }
  return columns.map((c) => (typeof c === "object" ? c : { key: c }));
}

// deno-lint-ignore no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const visibleLength = (value: string): number => value.replace(ANSI_RE, "").length;

function pad(value: string, width: number, align: Align): string {
  const padding = " ".repeat(Math.max(0, width - visibleLength(value)));
  return align === "right" ? padding + value : value + padding;
}

function truncate(value: string, max: number): string {
  if (visibleLength(value) <= max) return value;
  if (max <= 1) return value.slice(0, max);
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

export function Table<T extends Row>(
  {
    rows,
    columns,
    focusedIndex,
    emptyMessage,
    limit,
    reservedRows = DEFAULT_RESERVED_ROWS,
    reservedCols = DEFAULT_RESERVED_COLS,
  }: Props<T>,
) {
  const theme = useTheme();
  const { stdout } = useStdout();
  const [termRows, setTermRows] = useState(stdout?.rows ?? FALLBACK_TERM_ROWS);
  const [termCols, setTermCols] = useState(stdout?.columns ?? FALLBACK_TERM_COLS);
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setTermRows(stdout.rows ?? FALLBACK_TERM_ROWS);
      setTermCols(stdout.columns ?? FALLBACK_TERM_COLS);
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  if (rows.length === 0) {
    return <DimText>{emptyMessage ?? "No data."}</DimText>;
  }

  const cols = normalizeColumns(rows, columns);
  const hasCursor = focusedIndex !== undefined;
  // Widths span ALL rows (not just the visible window) so columns stay put
  // while the viewport scrolls — then get fitted to the terminal width so a
  // row never wraps.
  const uncapped = cols.map((col) => {
    const header = col.header ?? String(col.key);
    return Math.max(
      visibleLength(header),
      ...rows.map((r) => visibleLength(String(r[col.key]))),
    );
  });
  const natural = cols.map((col, i) =>
    col.maxWidth !== undefined ? Math.min(uncapped[i], col.maxWidth) : uncapped[i]
  );
  const availableForCells = termCols - reservedCols - (hasCursor ? 2 : 0) -
    Math.max(0, cols.length - 1) * table.cellPadding;
  const widths = fit(natural, availableForCells);
  // Grow pass — the inverse of fit(): on wide terminals, hand leftover width
  // to `grow` columns (up to their real content width) so a capped
  // description uses the screen instead of leaving it blank.
  let leftover = availableForCells - widths.reduce((s, w) => s + w, 0);
  if (leftover > 0) {
    cols.forEach((col, i) => {
      if (!col.grow || leftover <= 0) return;
      const room = Math.max(0, uncapped[i] - widths[i]);
      const add = Math.min(room, leftover);
      widths[i] += add;
      leftover -= add;
    });
  }
  const gap = " ".repeat(table.cellPadding);
  const cursorPad = "  ";
  const totalWidth = (hasCursor ? 2 : 0) +
    widths.reduce((s, w) => s + w, 0) +
    Math.max(0, widths.length - 1) * table.cellPadding;

  // Viewport window centered on the focused row (same math as Select), so
  // the selection never scrolls out of sight and the edges clamp cleanly.
  const total = rows.length;
  const resolvedLimit = limit === "auto" ? Math.max(MIN_VIEW_ROWS, termRows - reservedRows) : limit;
  const view = resolvedLimit === undefined ? total : Math.min(resolvedLimit, total);
  const halfView = Math.floor(view / 2);
  const start = Math.max(0, Math.min(total - view, (focusedIndex ?? 0) - halfView));
  const end = start + view;
  const visible = rows.slice(start, end);

  return (
    <Box flexDirection="column">
      <Box>
        {hasCursor && <Text bold={table.headerBold}>{cursorPad}</Text>}
        {cols.map((col, i) => {
          const header = col.header ?? String(col.key);
          const cell = pad(truncate(header, widths[i]), widths[i], col.align ?? "left");
          const tail = i < cols.length - 1 ? gap : "";
          return (
            <Text key={String(col.key)} bold={table.headerBold}>
              {cell + tail}
            </Text>
          );
        })}
      </Box>
      <DimText>{table.separatorChar.repeat(totalWidth)}</DimText>
      {start > 0 && <DimText>▲ {start} more</DimText>}
      {visible.map((row, i) => {
        const rowIndex = start + i;
        const focused = rowIndex === focusedIndex;
        const color = focused ? table.focusColor : undefined;
        return (
          <Box key={rowIndex}>
            {hasCursor && <Text color={color}>{focused ? "❯ " : "  "}</Text>}
            {cols.map((col, j) => {
              const cell = pad(
                truncate(String(row[col.key]), widths[j]),
                widths[j],
                col.align ?? "left",
              );
              const tail = j < cols.length - 1 ? gap : "";
              // Non-focused rows render entirely dim by default. The focused
              // row uses focusColor on every cell so the selection stands out
              // against the muted backdrop. Columns flagged `bright` keep
              // their original color regardless (status dots etc).
              const shouldDim = !focused && !col.bright;
              return (
                <Text
                  key={String(col.key)}
                  color={shouldDim ? theme.dim : color}
                >
                  {cell + tail}
                </Text>
              );
            })}
          </Box>
        );
      })}
      {end < total && <DimText>▼ {total - end} more</DimText>}
    </Box>
  );
}
