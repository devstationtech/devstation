/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { BlueprintRecord } from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import { useBlueprint } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Spinner, Table } from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  blueprintName: string;
  onBack: () => void;
};

export function BlueprintDetailScreen({ blueprintName, onBack }: Props) {
  const blueprintApi = useBlueprint();
  const sessionId = useSessionId();
  const [blueprint, setBlueprint] = useState<BlueprintRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    blueprintApi.byId({ sessionId, id: blueprintName })
      .then((r) => setBlueprint(r))
      .catch(() => setBlueprint(null))
      .finally(() => setLoaded(true));
  }, [blueprintApi, sessionId, blueprintName]);

  useInput((_input, key) => {
    if (key.escape) onBack();
  });

  if (!loaded) {
    return (
      <ScreenFrame
        breadcrumb={["topologies", "blueprints", blueprintName]}
        footer={<HelpBar>esc back</HelpBar>}
      >
        <Spinner label="loading blueprint..." />
      </ScreenFrame>
    );
  }

  if (!blueprint) {
    return (
      <ScreenFrame
        breadcrumb={["topologies", "blueprints", blueprintName]}
        footer={<HelpBar>esc back</HelpBar>}
      >
        <Text color="red">Blueprint '{blueprintName}' not found.</Text>
      </ScreenFrame>
    );
  }

  const kind = blueprint.host
    ? `hosted → ${blueprint.host.blueprint}.${blueprint.host.role}`
    : "standalone";

  const summary = (
    <Box gap={2}>
      <Text bold>{blueprint.name}</Text>
      <DimText>v{blueprint.version}</DimText>
      <DimText>{kind}</DimText>
      <DimText>{blueprint.placement}</DimText>
      <DimText>source: {blueprint.origin}</DimText>
    </Box>
  );

  const stepRows = blueprint.host
    ? blueprint.steps.map((s) => ({
      role: blueprint.host!.role,
      step: s.name,
      description: s.description,
      verify: s.hasVerify ? "yes" : "—",
      rollback: s.hasRollback ? "yes" : "—",
    }))
    : blueprint.roles.flatMap((r) =>
      r.steps.map((s) => ({
        role: `${r.name} (${r.instances})`,
        step: s.name,
        description: s.description,
        verify: s.hasVerify ? "yes" : "—",
        rollback: s.hasRollback ? "yes" : "—",
      }))
    );

  const inputRows = blueprint.inputs.map((i) => ({
    name: i.name,
    label: i.label,
    type: i.type,
    required: i.required ? "yes" : "no",
    default: i.value !== undefined ? String(i.value) : "—",
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "blueprints", blueprint.name]}
      header={summary}
      footer={<HelpBar>esc back</HelpBar>}
    >
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>description</Text>
          <Text>{blueprint.description}</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>supported os</Text>
          <Text>{blueprint.compatibility.os.join(", ")}</Text>
        </Box>

        {inputRows.length > 0 && (
          <Box flexDirection="column">
            <Text bold>inputs</Text>
            <Table
              rows={inputRows}
              columns={[
                { key: "name" },
                { key: "label" },
                { key: "type" },
                { key: "required" },
                { key: "default" },
              ]}
              emptyMessage="No inputs."
            />
          </Box>
        )}

        <Box flexDirection="column">
          <Text bold>steps</Text>
          <Table
            rows={stepRows}
            columns={[
              { key: "role" },
              { key: "step" },
              { key: "description", maxWidth: 60 },
              { key: "verify" },
              { key: "rollback" },
            ]}
            emptyMessage="No steps."
          />
        </Box>
      </Box>
    </ScreenFrame>
  );
}
