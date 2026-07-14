/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { useInput } from "ink";
import type { VaultRecord as Record } from "@jsonrpc-contracts-ts/vault.gen.ts";
import { useVault } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { CreateVaultForm } from "@ui/vault/create-vault-form.tsx";
import { RenameVaultForm } from "@ui/vault/rename-vault-form.tsx";
import { VaultDetailScreen } from "@ui/vault/detail.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type Subscreen = "list" | "new" | "detail" | "rename" | "confirm-delete";

type Props = {
  onBack: () => void;
};

export function VaultScreen({ onBack }: Props) {
  const vault = useVault();
  const sessionId = useSessionId();
  const [vaults, setVaults] = useState<Record[] | null>(null);
  const [cursor, setCursor] = useNavigationState<number>("vaults:cursor", 0);
  const [subscreen, setSubscreen] = useState<Subscreen>("list");

  const reload = () =>
    vault.listVaults({ sessionId }).then((list) => {
      setVaults([...list]);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    });

  useEffect(() => {
    reload();
  }, []);

  const highlighted = vaults && vaults.length > 0 ? vaults[cursor] : null;

  useInput((input, key) => {
    if (subscreen !== "list") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.ctrl || key.meta) return;
    if (input === "c") {
      setSubscreen("new");
      return;
    }
    if (!vaults || vaults.length === 0) return;
    if (key.return) {
      setSubscreen("detail");
      return;
    }
    if (input === "r") {
      setSubscreen("rename");
      return;
    }
    if (input === "d") {
      setSubscreen("confirm-delete");
      return;
    }
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(vaults.length - 1, c + 1));
  });

  if (subscreen === "new") {
    return (
      <CreateVaultForm
        onBack={() => setSubscreen("list")}
        onCreated={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "detail" && highlighted) {
    return (
      <VaultDetailScreen
        vault={highlighted}
        onBack={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "rename" && highlighted) {
    return (
      <RenameVaultForm
        vaultId={highlighted.id}
        currentName={highlighted.name}
        onBack={() => setSubscreen("list")}
        onRenamed={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "confirm-delete" && highlighted) {
    return (
      <ConfirmDeleteScreen
        title="delete vault"
        itemId={highlighted.name}
        entityLabel="vault"
        onDelete={async () => {
          await vault.deleteVault({ sessionId, vaultId: highlighted.id });
        }}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  const hasItems = (vaults?.length ?? 0) > 0;
  const rows = (vaults ?? []).map((v) => ({
    name: v.name,
    version: `v${v.version}`,
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "vaults"]}
      footer={
        <HelpBar>
          {hasItems ? "c create   ↵ open   r rename   d delete   esc back" : "c create   esc back"}
        </HelpBar>
      }
    >
      {vaults === null ? <DimText>Loading...</DimText> : (
        <Table
          rows={rows}
          columns={[
            { key: "name" },
            { key: "version", align: "right" },
          ]}
          focusedIndex={hasItems ? cursor : undefined}
          emptyMessage="No vaults found. Press c to create one."
        />
      )}
    </ScreenFrame>
  );
}
