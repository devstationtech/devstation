/// <reference types="@types/react" />
import { Box, Text } from "ink";
import chalk from "chalk";
import { VERSION } from "@ui/cli/version.ts";

const LOGO = [
  "  ▌         ▐     ▐  ▗       ",
  "▞▀▌▞▀▖▌ ▌▞▀▘▜▀ ▝▀▖▜▀ ▄ ▞▀▖▛▀▖",
  "▌ ▌▛▀ ▐▐ ▝▀▖▐ ▖▞▀▌▐ ▖▐ ▌ ▌▌ ▌",
  "▝▀▘▝▀▘ ▘ ▀▀  ▀ ▝▀▘ ▀ ▀▘▝▀ ▘ ▘",
];

const DEV_END = 9;

export function Logo() {
  return (
    <Box flexDirection="column">
      {LOGO.map((line, i) => (
        <Text key={i}>
          {chalk.hex("#aeaeae")(line.slice(0, DEV_END))}
          {chalk.hex("#323232fc")(line.slice(DEV_END))}
        </Text>
      ))}
    </Box>
  );
}

export { VERSION };
