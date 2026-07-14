/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { HeaderCard } from "@ui/shared/design-system/composites/header-card.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";
import { checkForUpdate, type UpdateStatus } from "@ui/self-update/mod.ts";

export type Screen = "topologies" | "mcp" | "update";

/**
 * Main-menu entries. Only the two top-level areas for now; `update` is not a
 * menu item — it surfaces as a bottom notification + `U` shortcut when a newer
 * version exists (mirroring the "Press Ctrl+C again to exit" footer).
 */
const MENU: { screen: Screen; label: string; description: string }[] = [
  {
    screen: "topologies",
    label: "topologies",
    description: "clusters, nodes, virtual machines and sizes",
  },
  { screen: "mcp", label: "mcp", description: "manage the scoped MCP access token" },
];

type Props = {
  onNavigate: (screen: Screen) => void;
  /**
   * Update-check seam. Defaults to the real cache-aware check; tests
   * inject a stub to drive the footer deterministically.
   */
  checkUpdate?: () => Promise<UpdateStatus>;
};

export function HomeScreen({ onNavigate, checkUpdate = checkForUpdate }: Props) {
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows ?? 30);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    let alive = true;
    // Fire-and-forget: never blocks the render, never throws (the check
    // resolves to `unknown` on any failure).
    checkUpdate().then((s) => {
      if (alive) setUpdateStatus(s);
    }).catch(() => {/* defensive — checkForUpdate already swallows */});
    return () => {
      alive = false;
    };
  }, [checkUpdate]);

  useEffect(() => {
    const onResize = () => setRows(stdout.rows ?? 30);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const updateAvailable = updateStatus?.kind === "available";

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(MENU.length - 1, c + 1));
      return;
    }
    if (key.return) {
      onNavigate(MENU[cursor].screen);
      return;
    }
    // `U` jumps to the updater — only wired here (the main menu), so it never
    // collides with screen-specific `u` bindings (e.g. `u uninstall`).
    if ((input === "u" || input === "U") && updateAvailable) {
      onNavigate("update");
    }
  });

  return (
    <Box flexDirection="column" height={rows} padding={1}>
      <HeaderCard />
      <Box flexDirection="column" paddingX={2} paddingTop={1}>
        {MENU.map(({ screen, label, description }, i) => {
          const focused = i === cursor;
          return (
            <Box key={screen} gap={2}>
              <Text color={focused ? "white" : undefined} bold={focused}>
                {focused ? "❯ " : "  "}
                {label.padEnd(12)}
              </Text>
              <DimText>{description}</DimText>
            </Box>
          );
        })}
      </Box>
      <Box paddingX={2} paddingTop={1}>
        <DimText>↑↓ select ↵ open ctrl+c exit</DimText>
      </Box>
      <Box flexGrow={1} />
      {updateStatus?.kind === "available" && (
        <Box paddingX={2}>
          <Text color="yellow">
            New version {updateStatus.latest} available — press <Text bold>U</Text> to update
          </Text>
        </Box>
      )}
    </Box>
  );
}
