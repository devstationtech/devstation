/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "@ui/shared/design-system/tokens.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

export type SelectItem<V> = {
  key?: string;
  label: string;
  value: V;
  secondary?: string | string[];
};

type Props<V> = {
  items: SelectItem<V>[];
  isFocused?: boolean;
  initialIndex?: number;
  limit?: number;
  currentValue?: V;
  onCommit: (item: SelectItem<V>) => void;
  onAdvance?: () => void;
  onHighlight?: (item: SelectItem<V>) => void;
};

const DEFAULT_LIMIT = 10;

function asColumns(secondary: string | string[] | undefined): string[] {
  if (Array.isArray(secondary)) return secondary;
  if (secondary) return [secondary];
  return [];
}

export function Select<V>({
  items,
  isFocused = true,
  initialIndex = 0,
  limit = DEFAULT_LIMIT,
  currentValue,
  onCommit,
  onAdvance,
  onHighlight,
}: Props<V>) {
  const [cursor, setCursor] = useState(Math.max(0, Math.min(items.length - 1, initialIndex)));

  useEffect(() => {
    setCursor(Math.max(0, Math.min(items.length - 1, initialIndex)));
  }, [initialIndex, items.length]);

  const labelWidth = items.reduce((max, i) => Math.max(max, i.label.length), 0);
  const colWidths: number[] = [];
  for (const it of items) {
    const cols = asColumns(it.secondary);
    for (let j = 0; j < cols.length; j++) {
      colWidths[j] = Math.max(colWidths[j] ?? 0, cols[j].length);
    }
  }

  useInput((char, key) => {
    if (items.length === 0) return;
    if (key.upArrow) {
      const next = Math.max(0, cursor - 1);
      if (next !== cursor) {
        setCursor(next);
        onHighlight?.(items[next]);
      }
      return;
    }
    if (key.downArrow) {
      const next = Math.min(items.length - 1, cursor + 1);
      if (next !== cursor) {
        setCursor(next);
        onHighlight?.(items[next]);
      }
      return;
    }
    if (char === " ") {
      onCommit(items[cursor]);
      return;
    }
    if (key.return) {
      onCommit(items[cursor]);
      onAdvance?.();
      return;
    }
  }, { isActive: isFocused });

  const total = items.length;
  const view = Math.min(limit, total);
  const halfLimit = Math.floor(view / 2);
  const start = Math.max(0, Math.min(Math.max(0, total - view), cursor - halfLimit));
  const end = Math.min(total, start + view);
  const visible = items.slice(start, end);

  return (
    <Box flexDirection="column">
      {start > 0 && <DimText>▲ {start} more</DimText>}
      {visible.map((item, idx) => {
        const realIdx = start + idx;
        const isCursor = realIdx === cursor;
        const isCurrent = currentValue !== undefined && item.value === currentValue;
        const cols = asColumns(item.secondary);
        const labelText = cols.length > 0 ? item.label.padEnd(labelWidth) : item.label;
        return (
          <Box key={item.key ?? String(item.value)}>
            <Text color={isCursor ? colors.accent : undefined}>{isCursor ? "❯ " : "  "}</Text>
            <Text color={isCursor ? colors.accent : undefined} inverse={isCurrent}>
              {labelText}
            </Text>
            {cols.map((part, j) => {
              const isLast = j === cols.length - 1;
              const padded = isLast ? part : part.padEnd(colWidths[j]);
              return (
                <DimText key={j} inverse={isCurrent}>
                  {`  ${padded}`}
                </DimText>
              );
            })}
          </Box>
        );
      })}
      {end < total && <DimText>▼ {total - end} more</DimText>}
    </Box>
  );
}
