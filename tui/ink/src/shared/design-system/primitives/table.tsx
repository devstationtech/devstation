/// <reference types="@types/react" />
import { Box, Text } from "ink";
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
};

type Props<T extends Row> = {
  rows: T[];
  columns?: (keyof T)[] | Column<T>[];
  focusedIndex?: number;
  emptyMessage?: string;
};

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

export function Table<T extends Row>({ rows, columns, focusedIndex, emptyMessage }: Props<T>) {
  const theme = useTheme();
  if (rows.length === 0) {
    return <DimText>{emptyMessage ?? "No data."}</DimText>;
  }

  const cols = normalizeColumns(rows, columns);
  const widths = cols.map((col) => {
    const header = col.header ?? String(col.key);
    const natural = Math.max(
      visibleLength(header),
      ...rows.map((r) => visibleLength(String(r[col.key]))),
    );
    return col.maxWidth !== undefined ? Math.min(natural, col.maxWidth) : natural;
  });
  const hasCursor = focusedIndex !== undefined;
  const gap = " ".repeat(table.cellPadding);
  const cursorPad = "  ";
  const totalWidth = (hasCursor ? 2 : 0) +
    widths.reduce((s, w) => s + w, 0) +
    Math.max(0, widths.length - 1) * table.cellPadding;

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
      {rows.map((row, i) => {
        const focused = i === focusedIndex;
        const color = focused ? table.focusColor : undefined;
        return (
          <Box key={i}>
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
    </Box>
  );
}
