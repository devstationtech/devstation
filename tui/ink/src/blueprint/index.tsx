/// <reference types="@types/react" />
import { useCallback, useEffect, useState } from "react";
import { useInput } from "ink";
import type { BlueprintRecord } from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import { useBlueprint } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { BlueprintDetailScreen } from "@ui/blueprint/detail.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  onBack: () => void;
};

export function BlueprintScreen({ onBack }: Props) {
  const blueprintApi = useBlueprint();
  const sessionId = useSessionId();
  const [blueprints, setBlueprints] = useState<
    readonly BlueprintRecord[] | null
  >(null);
  const [cursor, setCursor] = useNavigationState<number>("blueprints:cursor", 0);
  const [openName, setOpenName] = useState<string | null>(null);

  const reload = useCallback(() => {
    blueprintApi.list({ sessionId }).then((list) => {
      setBlueprints(list);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    });
  }, [blueprintApi, sessionId, setCursor]);

  useEffect(() => {
    reload();
  }, [reload]);

  const hasItems = (blueprints?.length ?? 0) > 0;

  useInput((_input, key) => {
    if (openName) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (!blueprints || blueprints.length === 0) return;
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(blueprints.length - 1, c + 1));
    if (key.return) {
      const selected = blueprints[cursor];
      if (selected) setOpenName(selected.name);
    }
  });

  if (openName) {
    return (
      <BlueprintDetailScreen
        blueprintName={openName}
        onBack={() => setOpenName(null)}
      />
    );
  }

  const rows = (blueprints ?? []).map((b) => ({
    name: b.name,
    source: b.origin === "local" ? "local" : "official",
    kind: b.host ? `hosted → ${b.host.blueprint}.${b.host.role}` : "standalone",
    description: b.description,
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "blueprints"]}
      footer={<HelpBar>↵ open esc back</HelpBar>}
    >
      {blueprints === null ? <DimText>Loading...</DimText> : (
        <Table
          rows={rows}
          columns={[
            { key: "name" },
            { key: "source" },
            { key: "kind", maxWidth: 28 },
            { key: "description", maxWidth: 40 },
          ]}
          focusedIndex={hasItems ? cursor : undefined}
          emptyMessage="No blueprints available. Add your own under ~/.devstation/blueprints/<name>/blueprint.yaml."
        />
      )}
    </ScreenFrame>
  );
}
