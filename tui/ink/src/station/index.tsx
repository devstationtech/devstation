/// <reference types="@types/react" />
import { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { StationRecord } from "@jsonrpc-contracts-ts/station.gen.ts";
import { useStation } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { StationDetailScreen } from "@ui/station/detail.tsx";
import { StationForm } from "@ui/station/form.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  onBack: () => void;
};

export function StationScreen({ onBack }: Props) {
  const station = useStation();
  const sessionId = useSessionId();
  const [stations, setStations] = useState<readonly StationRecord[] | null>(null);
  const [cursor, setCursor] = useNavigationState<number>("stations:cursor", 0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const reload = useCallback(() => {
    station.list({ sessionId }).then((list) => {
      setStations(list);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    });
  }, [station, sessionId, setCursor]);

  useEffect(() => {
    reload();
  }, [reload]);

  const hasItems = (stations?.length ?? 0) > 0;

  useInput((input, key) => {
    if (openId || registering || confirmingDelete) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (input === "r") {
      setRegistering(true);
      return;
    }
    if (!stations || stations.length === 0) return;
    if (input === "u") {
      setConfirmingDelete(true);
      return;
    }
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(stations.length - 1, c + 1));
    if (key.return) {
      const selected = stations[cursor];
      if (selected) setOpenId(selected.id);
    }
  });

  if (registering) {
    return (
      <StationForm
        mode="create"
        onBack={() => setRegistering(false)}
        onSaved={() => {
          setRegistering(false);
          reload();
        }}
      />
    );
  }

  const selected = stations && stations.length > 0 ? stations[cursor] : null;

  if (confirmingDelete && selected) {
    const hasServices = selected.serviceCount > 0;
    const warning = hasServices
      ? (
        <Box flexDirection="column" gap={1}>
          <Text color="yellow">
            ⚠ '{selected.name}' still has {selected.serviceCount}{" "}
            service(s). Unregistering the station only deletes its record — it does NOT tear down
            anything installed. Destroy the station first if its services are running.
          </Text>
        </Box>
      )
      : undefined;
    return (
      <ConfirmDeleteScreen
        title="unregister station"
        itemId={selected.name}
        entityLabel="station"
        warning={warning}
        confirmWord={hasServices ? "unregister" : undefined}
        onDelete={() => station.unregister({ sessionId, stationId: selected.id })}
        onConfirmed={() => {
          setConfirmingDelete(false);
          reload();
        }}
        onBack={() => setConfirmingDelete(false)}
      />
    );
  }

  if (openId) {
    return (
      <StationDetailScreen
        stationId={openId}
        onBack={() => {
          setOpenId(null);
          reload();
        }}
      />
    );
  }

  const rows = (stations ?? []).map((s) => ({
    name: s.name,
    description: s.description,
    status: s.status,
    services: formatServiceStats(s.serviceCount, s.serviceStats),
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "stations"]}
      footer={
        <HelpBar>
          {hasItems ? "↵ open r register u unregister esc back" : "r register esc back"}
        </HelpBar>
      }
    >
      {stations === null ? <DimText>Loading...</DimText> : (
        <Table
          rows={rows}
          columns={[
            { key: "name" },
            { key: "description" },
            { key: "status" },
            { key: "services" },
          ]}
          focusedIndex={hasItems ? cursor : undefined}
          emptyMessage="No stations registered yet. Press r to register one."
        />
      )}
    </ScreenFrame>
  );
}

/**
 * Compact per-status breakdown for the services column. Shows non-zero
 * statuses (failed/aborted/installing/registered) plus a total. Hides the
 * "installed" tag when everyone is INSTALLED (the total alone tells the
 * happy story). Examples:
 *   "no services"
 *   "3 services"                          (all INSTALLED)
 *   "1 registered, 3 services"            (mix)
 *   "1 failed, 1 installed, 2 services"    (partial failure)
 */
function formatServiceStats(
  total: number,
  stats: {
    registered: number;
    installing: number;
    installed: number;
    failed: number;
    aborted: number;
  },
): string {
  if (total === 0) return "no services";
  const parts: string[] = [];
  if (stats.failed > 0) parts.push(`${stats.failed} failed`);
  if (stats.aborted > 0) parts.push(`${stats.aborted} aborted`);
  if (stats.installing > 0) parts.push(`${stats.installing} installing`);
  if (stats.registered > 0) parts.push(`${stats.registered} registered`);
  if (stats.installed > 0 && stats.installed !== total) {
    parts.push(`${stats.installed} installed`);
  }
  parts.push(`${total} ${total === 1 ? "service" : "services"}`);
  return parts.join(", ");
}
