/// <reference types="@types/react" />
import { Box, Text } from "ink";
import chalk from "chalk";
import { useEffect, useState } from "react";
import { Logo, VERSION } from "@ui/shared/logo.tsx";
import { useSystemStats } from "@ui/shared/hooks/use-system-stats.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

const TIME_REFRESH_MS = 1000;

function formatUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}

import { currentHost, currentUser } from "@ui/cli/paths.ts";

function readUser(): string {
  return currentUser();
}

function readHostname(): string {
  return currentHost();
}

// Top-of-screen card: bordered (no title) wrapping the logo on the left and a
// session/host info column on the right, separated by a vertical rule. Info
// rows: user@hostname, UTC datetime (live), local CPU/RAM. Stays the same
// across all screens — gives the operator persistent context regardless of
// where they navigate.
export function HeaderCard() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TIME_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  const stats = useSystemStats();
  const user = readUser();
  const host = readHostname();
  // Pad to a constant 6-char field (`100.0%` is the widest possible value)
  // so the row width never changes between polls. Without this, the column's
  // width drifts and Yoga reflows every 2s — visible as a header "jump"
  // during heavy log streaming.
  const cpu = (stats ? `${stats.cpuPercent.toFixed(1)}%` : "…").padStart(6);
  const ram = (stats ? `${stats.ramPercent.toFixed(1)}%` : "…").padStart(6);

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
      paddingX={1}
      flexShrink={0}
    >
      <Logo />
      <Box flexDirection="column" alignItems="flex-end" flexShrink={0}>
        <Text bold>{user}@{host}</Text>
        <DimText>CPU {cpu} | RAM {ram}</DimText>
        <DimText>{formatUtc(now)}</DimText>
        <Text>{chalk.hex("#808080")(`v${VERSION}`)}</Text>
      </Box>
    </Box>
  );
}
