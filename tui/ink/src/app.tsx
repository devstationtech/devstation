/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { HomeScreen } from "@ui/home.tsx";
import { TopologiesScreen } from "@ui/topologies/index.tsx";
import { McpScreen } from "@ui/mcp/index.tsx";
import { UpdateScreen } from "@ui/self-update/update-screen.tsx";
import { AuthGate } from "@ui/auth/auth-gate.tsx";
import { RpcClientsProvider } from "@ui/rpc-clients-provider.tsx";
import type { Screen } from "@ui/home.tsx";

export function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    if (!confirmExit) return;
    const id = setTimeout(() => setConfirmExit(false), 1000);
    return () => clearTimeout(id);
  }, [confirmExit]);

  useInput((input, key) => {
    if (!key.ctrl || input !== "c") return;
    if (confirmExit) {
      exit();
    } else {
      setConfirmExit(true);
    }
  });

  return (
    <RpcClientsProvider>
      <Box flexDirection="column">
        {screen === null ? <HomeScreen onNavigate={setScreen} /> : screen === "update"
          // Update is unauthenticated — it only touches the manifest +
          // the local binary, no engine session needed.
          ? <UpdateScreen onBack={() => setScreen(null)} />
          : (
            <AuthGate onCancel={() => setScreen(null)}>
              {() =>
                screen === "mcp"
                  ? <McpScreen onBack={() => setScreen(null)} />
                  : <TopologiesScreen onBack={() => setScreen(null)} />}
            </AuthGate>
          )}
        {confirmExit && (
          <Box paddingX={2}>
            <Text color="yellow">Press Ctrl+C again to exit</Text>
          </Box>
        )}
      </Box>
    </RpcClientsProvider>
  );
}
