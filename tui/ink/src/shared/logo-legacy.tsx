/// <reference types="@types/react" />
import { Box, Text } from "ink";
import chalk from "chalk";
import denoJson from "../../../deno.json" with { type: "json" };

const LOGO = [
  "                                                                                                    ",
  "       ▄▄                                                                 ██                        ",
  "       ██                                  ██                  ██         ▀▀                        ",
  "  ▄███▄██   ▄████▄   ██▄  ▄██  ▄▄█████▄  ███████    ▄█████▄  ███████    ████      ▄████▄   ██▄████▄ ",
  " ██▀  ▀██  ██▄▄▄▄██   ██  ██   ██▄▄▄▄ ▀    ██       ▀ ▄▄▄██    ██         ██     ██▀  ▀██  ██▀   ██ ",
  " ██    ██  ██▀▀▀▀▀▀   ▀█▄▄█▀    ▀▀▀▀██▄    ██      ▄██▀▀▀██    ██         ██     ██    ██  ██    ██ ",
  " ▀██▄▄███  ▀██▄▄▄▄█    ████    █▄▄▄▄▄██    ██▄▄▄   ██▄▄▄███    ██▄▄▄   ▄▄▄██▄▄▄  ▀██▄▄██▀  ██    ██ ",
  "   ▀▀▀ ▀▀    ▀▀▀▀▀      ▀▀      ▀▀▀▀▀▀      ▀▀▀▀    ▀▀▀▀ ▀▀     ▀▀▀▀   ▀▀▀▀▀▀▀▀    ▀▀▀▀    ▀▀    ▀▀ ",
];

const DEV_END = 31;

export function LegacyLogo() {
  return (
    <Box flexDirection="column">
      {LOGO.map((line, i) => (
        <Text key={i}>
          {chalk.hex("#aeaeae")(line.slice(0, DEV_END))}
          {chalk.hex("#323232fc")(line.slice(DEV_END))}
        </Text>
      ))}
      <Box justifyContent="flex-end">
        <Text>{chalk.hex("#808080")(`v${denoJson.version}`)}</Text>
      </Box>
    </Box>
  );
}
