/// <reference types="@types/react" />
import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { type Intent, intentColor } from "@ui/shared/design-system/tokens.ts";

const intentIcon: Record<Intent, string> = {
  success: "✓",
  warning: "⚠",
  danger: "✗",
  info: "ℹ",
};

type Props = {
  intent: Intent;
  children: ReactNode;
};

export function Alert({ intent, children }: Props) {
  return (
    <Box>
      <Text color={intentColor[intent]} bold>{intentIcon[intent]}</Text>
      <Text color={intentColor[intent]}>{children}</Text>
    </Box>
  );
}
