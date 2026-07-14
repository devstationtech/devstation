/// <reference types="@types/react" />
import { Box, Text, useStdout } from "ink";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { HeaderCard } from "@ui/shared/design-system/composites/header-card.tsx";
import { TitledBox } from "@ui/shared/design-system/primitives/titled-box.tsx";
import { type Intent, table } from "@ui/shared/design-system/tokens.ts";

type Props = {
  breadcrumb: string[];
  intent?: Intent;
  header?: ReactNode;
  topRight?: ReactNode;
  secondary?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showLogo?: boolean;
  // boxLayout controls how the title box occupies vertical space:
  //   - "fill"   (default): box flex-grows to fill the terminal — used by
  //              lists, logs, trees that need scroll/grow.
  //   - "top":   box is natural-height and sits right under the header,
  //              empty space below. Sparse forms (auth/password) anchored
  //              to the top.
  //   - "center": box is natural-height and floats vertically centered.
  boxLayout?: "fill" | "top" | "center";
  // Optional content baked into the bottom border of the TitledBox, right-
  // aligned (e.g. a legend). Caller passes the rendered ReactNode and its
  // visible character count so the dashes are sized correctly.
  bottomRight?: ReactNode;
  bottomRightWidth?: number;
};

const SEPARATOR = " › ";

export function ScreenFrame(
  {
    breadcrumb,
    intent,
    header,
    topRight,
    secondary,
    children,
    footer,
    showLogo = true,
    boxLayout = "fill",
    bottomRight,
    bottomRightWidth = 0,
  }: Props,
) {
  const title = breadcrumb.join(SEPARATOR);
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows ?? 30);
  const [cols, setCols] = useState(stdout.columns ?? 80);
  useEffect(() => {
    const onResize = () => {
      setRows(stdout.rows ?? 30);
      setCols(stdout.columns ?? 80);
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  // Inner width of the TitledBox body — used to size the subHeader's
  // horizontal rule. Outer container has padding=1 each side, TitledBox draws
  // 1 border each side and applies paddingX={1} inside, so subtract 6.
  const innerWidth = Math.max(0, cols - 6);

  // Compact layouts ("top"/"center") are sparse forms (auth, password); a
  // separator under a single topRight hint there feels heavy. The separator
  // only renders for the default "fill" layout where it actually delineates
  // tabs/status from the body.
  const showSubHeaderSeparator = boxLayout === "fill";
  const subHeader = (header || topRight)
    ? (
      <Box flexDirection="column" flexShrink={0}>
        <Box justifyContent="space-between">
          <Box>{header}</Box>
          <Box>{topRight}</Box>
        </Box>
        {showSubHeaderSeparator && (
          <Text color={table.borderColor}>
            {table.separatorChar.repeat(innerWidth)}
          </Text>
        )}
      </Box>
    )
    : null;

  const body = (
    <>
      {subHeader}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0}>
        {children}
      </Box>
    </>
  );

  return (
    <Box flexDirection="column" padding={1} height={rows}>
      {showLogo && <HeaderCard />}
      {boxLayout === "fill"
        ? (
          <TitledBox
            title={title}
            intent={intent}
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            bottomRight={bottomRight}
            bottomRightWidth={bottomRightWidth}
          >
            {body}
          </TitledBox>
        )
        : (
          // "top" and "center" both render a natural-height box. The wrapper
          // grows to consume the leftover space and aligns accordingly.
          <Box
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            flexDirection="column"
            justifyContent={boxLayout === "center" ? "center" : "flex-start"}
          >
            <TitledBox
              title={title}
              intent={intent}
              bottomRight={bottomRight}
              bottomRightWidth={bottomRightWidth}
            >
              {body}
            </TitledBox>
          </Box>
        )}
      {secondary && <Box flexShrink={0} marginTop={1}>{secondary}</Box>}
      {footer && <Box flexShrink={0} marginTop={1}>{footer}</Box>}
    </Box>
  );
}
