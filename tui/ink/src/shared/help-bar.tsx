/// <reference types="@types/react" />
import { Box } from "ink";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = { children: string; marginTop?: number };

export function HelpBar({ children, marginTop = 0 }: Props) {
  return (
    <Box marginTop={marginTop}>
      <DimText>{children}</DimText>
    </Box>
  );
}
