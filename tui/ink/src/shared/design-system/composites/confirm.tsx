/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ReactNode } from "react";
import { TextInput } from "@ui/shared/design-system/primitives/text-input.tsx";

export type ConfirmIntent = "warning" | "danger" | "info";

type Props = {
  intent?: ConfirmIntent;
  question: string;
  confirmWord: string;
  details?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

const intentConfig: Record<ConfirmIntent, { color: string; icon: string }> = {
  warning: { color: "yellow", icon: "⚠" },
  danger: { color: "red", icon: "⚠" },
  info: { color: "cyan", icon: "▼" },
};

export function Confirm(
  { intent = "warning", question, confirmWord, details, onConfirm, onCancel }: Props,
) {
  const [value, setValue] = useState("");
  const cfg = intentConfig[intent];

  useInput((_char, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={cfg.color} bold>{cfg.icon} {question}</Text>
      {details}
      <Text>
        Type <Text color={cfg.color}>{confirmWord}</Text> to confirm:
      </Text>
      <Box gap={1}>
        <Text color={cfg.color}>❯</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={(v) => {
            if (v === confirmWord) onConfirm();
          }}
          focus
        />
      </Box>
    </Box>
  );
}
