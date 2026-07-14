/// <reference types="@types/react" />
import { Box, Text, useStdout } from "ink";
import { type ReactNode, useEffect, useState } from "react";
import { type Intent, intentColor, table } from "@ui/shared/design-system/tokens.ts";
import { useTheme } from "@ui/shared/theme/mod.ts";

type Props = {
  title?: string;
  intent?: Intent;
  children: ReactNode;
  flexGrow?: number;
  flexShrink?: number;
  minHeight?: number;
  // Optional content embedded in the bottom border (right-aligned), e.g. a
  // legend. Caller must supply the visible character count via
  // `bottomRightWidth` so the leading dashes are sized correctly.
  bottomRight?: ReactNode;
  bottomRightWidth?: number;
};

const CHARS = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
};

// Custom rebuild of the title-box primitive. The upstream
// @mishieck/ink-titled-box has the top-border's visibility tied to the
// `borderBottom` prop (likely a typo in their source — `topBorder.isVisible`
// is set from `borderBottom`), which made it impossible to disable the bottom
// border without losing the title at the top. We render the top and bottom
// border rows manually as Text and put a regular Ink Box in the middle with
// only the side borders. That gives us full control over both edges —
// including embedding optional content (e.g. a legend) in the bottom row.
export function TitledBox(
  {
    title,
    intent,
    children,
    flexGrow,
    flexShrink,
    minHeight,
    bottomRight,
    bottomRightWidth = 0,
  }: Props,
) {
  const theme = useTheme();
  const borderColor = intent ? intentColor[intent] : table.borderColor;
  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout.columns ?? 80);
  useEffect(() => {
    const onResize = () => setCols(stdout.columns ?? 80);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  // The TitledBox is meant to live inside a parent that constrains its width.
  // ScreenFrame wraps it in an outer container with padding=1 each side, so
  // the box's outer width is terminal cols minus 2.
  const boxWidth = Math.max(2, cols - 2);

  // Top border: `┌ title ───...───┐`. Title is rendered inverse (gray bg)
  // by splitting the row into 3 Text segments — Ink's `inverse` prop only
  // applies per-Text, so we can't use a single string.
  const topInterior = boxWidth - 2;
  const titleVisibleLength = title ? title.length + 2 : 0; // " title " padding
  const topAfterTitle = Math.max(0, topInterior - titleVisibleLength);

  // Bottom border. With bottomRight content we reserve space for it +
  // 2 trailing dashes; without it, a plain line.
  const bottomInterior = boxWidth - 2;
  const trailing = 2;
  const bottomLeading = bottomRight
    ? Math.max(0, bottomInterior - bottomRightWidth - trailing)
    : bottomInterior;

  return (
    <Box flexDirection="column" flexGrow={flexGrow} flexShrink={flexShrink} minHeight={minHeight}>
      <Box flexDirection="row">
        <Text color={borderColor}>{CHARS.topLeft}</Text>
        {title && (
          <Text backgroundColor={theme.chipBackground} color={theme.chipForeground}>
            {` ${title} `}
          </Text>
        )}
        <Text color={borderColor}>
          {CHARS.horizontal.repeat(topAfterTitle)}
          {CHARS.topRight}
        </Text>
      </Box>
      <Box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        borderStyle="single"
        borderColor={borderColor}
        borderTop={false}
        borderBottom={false}
        paddingX={1}
        paddingY={1}
      >
        {children}
      </Box>
      {bottomRight
        ? (
          <Box flexDirection="row">
            <Text color={borderColor}>
              {CHARS.bottomLeft}
              {CHARS.horizontal.repeat(bottomLeading)}
            </Text>
            {bottomRight}
            <Text color={borderColor}>
              {CHARS.horizontal.repeat(trailing)}
              {CHARS.bottomRight}
            </Text>
          </Box>
        )
        : (
          <Text color={borderColor}>
            {CHARS.bottomLeft}
            {CHARS.horizontal.repeat(bottomInterior)}
            {CHARS.bottomRight}
          </Text>
        )}
    </Box>
  );
}
