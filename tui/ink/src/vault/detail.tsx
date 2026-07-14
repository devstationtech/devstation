/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { VaultRecord } from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { SecretRecord } from "@jsonrpc-contracts-ts/vault.gen.ts";
import { useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { GenerateSecretForm } from "@ui/vault/generate-secret-form.tsx";
import { RenameSecretForm } from "@ui/vault/rename-secret-form.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type Subscreen = "list" | "new" | "rename" | "confirm-delete";

type Props = {
  vault: VaultRecord;
  onBack: () => void;
};

export function VaultDetailScreen({ vault, onBack }: Props) {
  const vaultClient = useVault();
  const sessionId = useSessionId();
  const [secrets, setSecrets] = useState<SecretRecord[] | null>(null);
  const [cursor, setCursor] = useNavigationState<number>(`vault:${vault.id}:cursor`, 0);
  const [subscreen, setSubscreen] = useState<Subscreen>("list");
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);

  const reload = () =>
    vaultClient.listSecrets({ sessionId, vaultId: vault.id }).then((list) => {
      setSecrets([...list]);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
      setRevealedId(null);
      setRevealedValue(null);
    });

  useEffect(() => {
    reload();
  }, []);

  const toggleReveal = async (secret: SecretRecord) => {
    if (revealedId === secret.id) {
      setRevealedId(null);
      setRevealedValue(null);
      return;
    }
    const { value } = await vaultClient.retrieveSecret({
      sessionId,
      vaultId: vault.id,
      secretId: secret.id,
    });
    setRevealedId(secret.id);
    setRevealedValue(value);
  };

  // `secrets[cursor]` was read at multiple sites without guarding against
  // undefined. Pre-delete the cursor was valid; after the secret list
  // shrank, a stale cursor (between `setSecrets` and the re-render that
  // runs the clamp in `reload()`) produced `undefined.id` and a
  // TUI-killing uncaught TypeError. Deriving `focusedSecret` once with a
  // length guard, then using it everywhere, makes the screen survive any
  // cursor/list mismatch.
  const focusedSecret = secrets && cursor < secrets.length ? secrets[cursor] : null;

  useInput((input, key) => {
    if (subscreen !== "list") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.ctrl || key.meta) return;
    if (input === "g") {
      setSubscreen("new");
      return;
    }
    if (!secrets || secrets.length === 0) return;
    if (key.return) {
      if (focusedSecret) toggleReveal(focusedSecret);
      return;
    }
    if (input === "r") {
      if (focusedSecret) setSubscreen("rename");
      return;
    }
    if (input === "d") {
      if (focusedSecret) setSubscreen("confirm-delete");
      return;
    }
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(secrets.length - 1, c + 1));
  });

  if (subscreen === "new") {
    return (
      <GenerateSecretForm
        vaultId={vault.id}
        onBack={() => setSubscreen("list")}
        onCreated={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "rename" && focusedSecret) {
    return (
      <RenameSecretForm
        vaultId={vault.id}
        vaultName={vault.name}
        secretId={focusedSecret.id}
        currentName={focusedSecret.name}
        onBack={() => setSubscreen("list")}
        onRenamed={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "confirm-delete" && focusedSecret) {
    return (
      <ConfirmDeleteScreen
        title="delete secret"
        itemId={focusedSecret.name}
        entityLabel="secret"
        onDelete={async () => {
          await vaultClient.deleteSecret({
            sessionId,
            vaultId: vault.id,
            secretId: focusedSecret.id,
          });
        }}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  const hasItems = (secrets?.length ?? 0) > 0;
  const isRevealed = focusedSecret?.id === revealedId;

  const rows = (secrets ?? []).map((s) => ({
    name: s.name,
    description: s.description ?? "—",
    "created by": s.createdBy,
    "created at": s.createdAt.slice(0, 10),
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "vaults", vault.name]}
      footer={
        <HelpBar>
          {hasItems
            ? "g generate   ↵ reveal/hide   r rename   d delete   esc back"
            : "g generate   esc back"}
        </HelpBar>
      }
    >
      <Box flexDirection="column" gap={1}>
        {secrets === null ? <DimText>Loading...</DimText> : (
          <Table
            rows={rows}
            columns={[
              { key: "name" },
              { key: "description" },
              { key: "created by" },
              { key: "created at" },
            ]}
            focusedIndex={hasItems ? cursor : undefined}
            emptyMessage="No secrets found. Press g to generate one."
          />
        )}
        {isRevealed && focusedSecret && (
          <Box gap={2}>
            <DimText>{focusedSecret.name} value:</DimText>
            <Text color="cyan">{revealedValue ?? "—"}</Text>
          </Box>
        )}
      </Box>
    </ScreenFrame>
  );
}
