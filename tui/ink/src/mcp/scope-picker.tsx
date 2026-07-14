/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "@ui/shared/design-system/tokens.ts";
import { ALL_SCOPE_OPTIONS, MCP_SCOPE_GROUPS } from "@ui/mcp/scope-catalog.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  /** Scopes currently checked. */
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (scope: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
};

/**
 * Grouped checkbox list for picking the scopes an MCP token will grant.
 *
 * Up/down moves the cursor across the flat list of scopes (group labels
 * are headers, not stops); space toggles; enter confirms; esc cancels.
 */
export function ScopePicker({ selected, onToggle, onSubmit, onCancel }: Props) {
  const [cursor, setCursor] = useState(0);
  const last = ALL_SCOPE_OPTIONS.length - 1;

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

  let flatIndex = -1;
  return (
    <Box flexDirection="column">
      {MCP_SCOPE_GROUPS.map((group) => (
        <Box key={group.label} flexDirection="column" marginBottom={1}>
          <Text bold color={colors.primary}>{group.label}</Text>
          {group.scopes.map((option) => {
            flatIndex += 1;
            const isCursor = flatIndex === cursor;
            const isChecked = selected.has(option.scope);
            const tint = isCursor ? colors.accent : undefined;
            return (
              <Box key={option.scope}>
                <Text color={tint}>{isCursor ? "❯ " : "  "}</Text>
                <Text color={isChecked ? colors.success : tint}>
                  {isChecked ? "[x] " : "[ ] "}
                </Text>
                <Text color={tint} bold={isCursor}>{option.label.padEnd(18)}</Text>
                <DimText>{option.description}</DimText>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
