/// <reference types="@types/react" />
import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import { spinner } from "@ui/shared/design-system/tokens.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  label?: string;
};

export function Spinner({ label }: Props) {
  return (
    <Box gap={1}>
      <Text color={spinner.color}>
        <InkSpinner type={spinner.type} />
      </Text>
      {label && <DimText>{label}</DimText>}
    </Box>
  );
}
