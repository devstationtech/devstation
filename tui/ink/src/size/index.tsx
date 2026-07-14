/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { useInput } from "ink";
import type { SizeRecord as Record } from "@jsonrpc-contracts-ts/size.gen.ts";
import { useSize } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { RegisterSizeForm } from "@ui/size/register-form.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Subscreen = "list" | "new" | "confirm-delete";

type Props = {
  onBack: () => void;
};

export function SizeScreen({ onBack }: Props) {
  const size = useSize();
  const sessionId = useSessionId();
  const [sizes, setSizes] = useState<Record[] | null>(null);
  const [cursor, setCursor] = useNavigationState<number>("sizes:cursor", 0);
  const [subscreen, setSubscreen] = useState<Subscreen>("list");

  const reload = () =>
    size.list({ sessionId }).then((list) => {
      setSizes([...list]);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    });

  useEffect(() => {
    reload();
  }, []);

  const highlighted = sizes && sizes.length > 0 ? sizes[cursor] : null;

  useInput((input, key) => {
    if (subscreen !== "list") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.ctrl || key.meta) return;
    if (input === "r") {
      setSubscreen("new");
      return;
    }
    if (!sizes || sizes.length === 0) return;
    if (input === "u") {
      setSubscreen("confirm-delete");
      return;
    }
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(sizes.length - 1, c + 1));
  });

  if (subscreen === "new") {
    return (
      <RegisterSizeForm
        onBack={() => setSubscreen("list")}
        onCreated={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "confirm-delete" && highlighted) {
    return (
      <ConfirmDeleteScreen
        title="delete size"
        itemId={highlighted.name}
        entityLabel="size"
        onDelete={() => size.unregister({ sessionId, sizeId: highlighted.id })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  const hasItems = (sizes?.length ?? 0) > 0;
  const rows = (sizes ?? []).map((d) => ({
    name: d.name,
    provider: d.provider,
    cpu: d.cpu !== undefined ? `${d.cpu}c` : "—",
    ram: d.ram !== undefined ? `${d.ram}MB` : "—",
    disk: d.disk !== undefined ? `${d.disk}GB` : "—",
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "sizing"]}
      footer={
        <HelpBar>
          {hasItems ? "r register   u unregister   esc back" : "r register   esc back"}
        </HelpBar>
      }
    >
      {sizes === null ? <DimText>Loading...</DimText> : (
        <Table
          rows={rows}
          columns={[
            { key: "name" },
            { key: "provider" },
            { key: "cpu", align: "right" },
            { key: "ram", align: "right" },
            { key: "disk", align: "right" },
          ]}
          focusedIndex={hasItems ? cursor : undefined}
          emptyMessage="No sizes found. Press r to register one."
        />
      )}
    </ScreenFrame>
  );
}
