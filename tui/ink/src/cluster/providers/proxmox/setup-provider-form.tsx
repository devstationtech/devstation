/// <reference types="@types/react" />
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";
import { useCluster, useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { useCursorBlink } from "@ui/shared/use-cursor-blink.ts";
import { ScreenFrame } from "@ui/shared/design-system/mod.ts";
import { currentHost, currentUser } from "@ui/cli/paths.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Step =
  | "provider"
  | "choose-secret"
  | "host"
  | "token-id"
  | "secret"
  | "testing"
  | "saving"
  | "done"
  | "error";

const PROVIDERS = ["proxmox"] as const;

type SecretOption = { id: string; name: string; vaultId: string };

type Props = {
  clusterId: string;
  clusterName: string;
  onBack: () => void;
  onDone: () => void;
};

const VAULT_NAME = "proxmox";
const NEW_SECRET_LABEL = "+ create new token";

export function SetupProviderForm({ clusterId, clusterName, onBack, onDone }: Props) {
  const vaultClient = useVault();
  const clusterApi = useCluster();
  const sessionId = useSessionId();
  const [step, setStep] = useState<Step>("provider");
  const [providerIndex, setProviderIndex] = useState(0);
  const [secretOptions, setSecretOptions] = useState<SecretOption[]>([]);
  const [secretCursor, setSecretCursor] = useState(0);
  const [providerHost, setProviderHost] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [tokenSecret, setTokenSecret] = useState("");
  const [error, setError] = useState("");
  const [nodeCount, setNodeCount] = useState(0);
  const cursorVisible = useCursorBlink();

  const fullToken = `${tokenId.trim()}=${tokenSecret.trim()}`;

  const loadSecretOptions = async () => {
    const vaults = await vaultClient.listVaults({ sessionId });
    const vault = vaults.find((v) => v.name === VAULT_NAME);
    if (!vault) {
      setSecretOptions([]);
      return;
    }
    const secrets = await vaultClient.listSecrets({ sessionId, vaultId: vault.id });
    setSecretOptions(secrets.map((s) => ({ id: s.id, name: s.name, vaultId: vault.id })));
  };

  const handleProviderConfirm = () => setStep("host");

  const handleHostConfirm = async () => {
    if (!providerHost.trim()) {
      setError("host is required.");
      return;
    }
    setError("");
    await loadSecretOptions();
    setStep("choose-secret");
  };

  const handleSelectExisting = async () => {
    const selected = secretOptions[secretCursor];
    setStep("testing");
    try {
      const { value: token } = await vaultClient.retrieveSecret({
        sessionId,
        vaultId: selected.vaultId,
        secretId: selected.id,
      });
      if (!token) {
        setError("could not resolve secret. try re-authenticating.");
        setStep("error");
        return;
      }
      const result = await clusterApi.testConnection({
        sessionId,
        host: providerHost,
        token,
      });
      if (!result.ok) {
        setError(result.error);
        setStep("error");
        return;
      }
      setNodeCount(result.nodeCount);
      setStep("saving");
      await clusterApi.connect({
        sessionId,
        clusterId,
        host: providerHost.trim(),
        vaultId: selected.vaultId,
        secretId: selected.id,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "connection failed.");
      setStep("error");
    }
  };

  const handleTokenIdSubmit = () => {
    const v = tokenId.trim();
    if (!v) {
      setError("token ID is required.");
      return;
    }
    if (!v.includes("!")) {
      setError("expected format: user@realm!tokenname");
      return;
    }
    setError("");
    setStep("secret");
  };

  const handleNewTokenSubmit = async () => {
    if (!tokenSecret.trim()) {
      setError("secret is required.");
      return;
    }
    setError("");
    setStep("testing");

    try {
      const result = await clusterApi.testConnection({
        sessionId,
        host: providerHost,
        token: fullToken,
      });
      if (!result.ok) {
        setError(result.error);
        setStep("error");
        return;
      }
      setNodeCount(result.nodeCount);

      setStep("saving");
      const user = currentUser();
      const hostname = currentHost();

      const vaults = await vaultClient.listVaults({ sessionId });
      let vaultId = vaults.find((v) => v.name === VAULT_NAME)?.id;
      if (!vaultId) {
        await vaultClient.createVault({ sessionId, name: VAULT_NAME, user, hostname });
        const vaultsAfter = await vaultClient.listVaults({ sessionId });
        vaultId = vaultsAfter.find((v) => v.name === VAULT_NAME)?.id;
        if (!vaultId) throw new Error("failed to create vault.");
      }

      const secretName = `${clusterName}-api-token`;
      const existingSecrets = await vaultClient.listSecrets({ sessionId, vaultId: vaultId });
      const existing = existingSecrets.find((s) => s.name === secretName);
      if (existing) {
        await vaultClient.deleteSecret({ sessionId, vaultId: vaultId!, secretId: existing.id });
      }

      await vaultClient.generateSecret({
        sessionId,
        vaultId,
        name: secretName,
        hostname,
        user,
        value: fullToken,
        description: `Proxmox API token for cluster ${clusterName}`,
      });

      const secretsAfter = await vaultClient.listSecrets({ sessionId, vaultId: vaultId });
      const secret = secretsAfter.find((s) => s.name === secretName);
      if (!secret) throw new Error("failed to create secret.");

      await clusterApi.connect({
        sessionId,
        clusterId,
        host: providerHost.trim(),
        vaultId,
        secretId: secret.id,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "setup failed.");
      setStep("error");
    }
  };

  // --- Input handlers ---

  useInput((_char, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.leftArrow) {
      setProviderIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.rightArrow) {
      setProviderIndex((i) => Math.min(PROVIDERS.length - 1, i + 1));
      return;
    }
    if (key.return) handleProviderConfirm();
  }, { isActive: step === "provider" });

  useInput((char, key) => {
    if (key.escape) {
      setStep("provider");
      setError("");
      return;
    }
    if (key.return) {
      handleHostConfirm();
      return;
    }
    if (key.backspace || key.delete) {
      setProviderHost((v) => v.slice(0, -1));
      setError("");
      return;
    }
    if (!key.ctrl && !key.meta && char) {
      setProviderHost((v) => v + char);
      setError("");
    }
  }, { isActive: step === "host" });

  useInput((_char, key) => {
    if (key.escape) {
      setStep("host");
      return;
    }
    const total = secretOptions.length + 1;
    if (key.upArrow) {
      setSecretCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setSecretCursor((c) => Math.min(total - 1, c + 1));
      return;
    }
    if (key.return) {
      if (secretCursor < secretOptions.length) handleSelectExisting();
      else setStep("token-id");
    }
  }, { isActive: step === "choose-secret" });

  useInput((char, key) => {
    if (key.escape) {
      setStep("choose-secret");
      setError("");
      return;
    }
    if (key.return) {
      handleTokenIdSubmit();
      return;
    }
    if (key.backspace || key.delete) {
      setTokenId((v) => v.slice(0, -1));
      setError("");
      return;
    }
    if (!key.ctrl && !key.meta && char) {
      setTokenId((v) => v + char);
      setError("");
    }
  }, { isActive: step === "token-id" });

  useInput((char, key) => {
    if (key.escape) {
      setStep("token-id");
      setError("");
      return;
    }
    if (key.return) {
      handleNewTokenSubmit();
      return;
    }
    if (key.backspace || key.delete) {
      setTokenSecret((v) => v.slice(0, -1));
      setError("");
      return;
    }
    if (!key.ctrl && !key.meta && char) {
      setTokenSecret((v) => v + char);
      setError("");
    }
  }, { isActive: step === "secret" });

  useInput((_input, key) => {
    if (step === "done" && (key.return || key.escape)) onDone();
    if (step === "error" && key.escape) {
      setStep("choose-secret");
      setError("");
    }
  }, { isActive: step === "done" || step === "error" });

  const cur = cursorVisible ? "█" : " ";

  const footer = step === "provider"
    ? <HelpBar>← → select ↵ next esc cancel</HelpBar>
    : step === "host" || step === "token-id"
    ? <HelpBar>↵ next esc back</HelpBar>
    : step === "secret"
    ? <HelpBar>↵ test connection esc back</HelpBar>
    : step === "choose-secret"
    ? <HelpBar>↑↓ navigate ↵ select esc back</HelpBar>
    : step === "done" || step === "error"
    ? <HelpBar>esc back</HelpBar>
    : undefined;

  return (
    <ScreenFrame
      breadcrumb={["topologies", clusterName, "connect provider"]}
      footer={footer}
    >
      {step === "provider" && (
        <Box flexDirection="column">
          <DimText>Select provider:</DimText>
          <Box gap={1} marginTop={1}>
            <DimText>◀</DimText>
            <Text bold>{` ${PROVIDERS[providerIndex]} `}</Text>
            <DimText>▶</DimText>
          </Box>
        </Box>
      )}

      {step === "host" && (
        <Box flexDirection="column" marginTop={1}>
          <DimText>Host (IP or hostname of the Proxmox API):</DimText>
          <Box gap={1} marginTop={1}>
            <DimText>Host:</DimText>
            <Text>{providerHost}{chalk.dim(cur)}</Text>
          </Box>
          <DimText>(IP or hostname — e.g. 192.168.1.1 or proxmox.local)</DimText>
          {error && <Text color="red">{error}</Text>}
        </Box>
      )}

      {step === "choose-secret" && (
        <Box flexDirection="column">
          <DimText>Select an existing token or create a new one:</DimText>
          <Box flexDirection="column" marginTop={1}>
            {secretOptions.map((s, i) => {
              const focused = i === secretCursor;
              return (
                <Box key={s.id} gap={1}>
                  <Text color={focused ? "white" : undefined}>{focused ? "❯" : " "}</Text>
                  <Text color={focused ? "white" : undefined}>{s.name}</Text>
                </Box>
              );
            })}
            <Box gap={1}>
              <Text color={secretCursor === secretOptions.length ? "white" : undefined}>
                {secretCursor === secretOptions.length ? "❯" : " "}
              </Text>
              <Text color={secretCursor === secretOptions.length ? "yellow" : "gray"}>
                {NEW_SECRET_LABEL}
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {step === "token-id" && (
        <Box flexDirection="column" marginTop={1}>
          <DimText>Enter the API Token ID:</DimText>
          <Box gap={1} marginTop={1}>
            <DimText>Token ID:</DimText>
            <Text>{tokenId}{chalk.dim(cur)}</Text>
          </Box>
          <DimText>(format: user@realm!tokenname — e.g. root@pam!monitoring)</DimText>
          {error && <Text color="red">{error}</Text>}
        </Box>
      )}

      {step === "secret" && (
        <Box flexDirection="column">
          <Box gap={1}>
            <DimText>Token ID:</DimText>
            <Text>{tokenId}</Text>
          </Box>
          <Box gap={1} marginTop={1}>
            <DimText>Secret:</DimText>
            <Text>{tokenSecret.replace(/./g, "•")}{chalk.dim(cur)}</Text>
          </Box>
          <DimText>(the UUID secret value for this token)</DimText>
          {error && <Text color="red">{error}</Text>}
        </Box>
      )}

      {step === "testing" && <DimText>Testing connection to {providerHost}...</DimText>}

      {step === "saving" && <DimText>Saving connection...</DimText>}

      {step === "done" && (
        <Text color="green">
          {`✓ Provider connected. ${nodeCount} node${nodeCount !== 1 ? "s" : ""} found.`}
        </Text>
      )}

      {step === "error" && <Text color="red">{`Error: ${error}`}</Text>}
    </ScreenFrame>
  );
}
