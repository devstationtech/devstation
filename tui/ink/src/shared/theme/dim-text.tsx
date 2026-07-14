/**
 * Drop-in replacement for `<Text dimColor>...</Text>` that respects
 * the active theme. Dark mode uses subdued grey (the old Ink default);
 * light mode swaps to `blackBright` so the text stays legible on a
 * white terminal background.
 *
 * If the caller passes an explicit `color`, it wins — `<DimText
 * color="red">` renders red, just like the original
 * `<Text dimColor color="red">` did. Without an explicit color the
 * theme's dim token applies.
 *
 * Usage:
 *   <DimText>secondary hint</DimText>
 *   <DimText wrap="truncate-end">long thing</DimText>
 *   <DimText color="red">soft red</DimText>
 */
import React from "react";
import { Text, type TextProps } from "ink";
import { useTheme } from "@ui/shared/theme/use-theme.ts";

type DimTextProps = Omit<TextProps, "dimColor">;

export function DimText({ children, color, ...rest }: DimTextProps): React.ReactElement {
  const theme = useTheme();
  return React.createElement(Text, { ...rest, color: color ?? theme.dim }, children);
}
