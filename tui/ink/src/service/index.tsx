/// <reference types="@types/react" />
import { useCallback, useEffect, useState } from "react";
import { useInput } from "ink";
import type { StationServiceRecord } from "@jsonrpc-contracts-ts/station.gen.ts";
import { useStation } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { ServiceDetailScreen } from "@ui/service/detail.tsx";
import { ServiceForm } from "@ui/service/form.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type Props = {
  onBack: () => void;
};

export function ServiceScreen({ onBack }: Props) {
  const stationApi = useStation();
  const sessionId = useSessionId();
  const [services, setServices] = useState<readonly StationServiceRecord[] | null>(
    null,
  );
  const [cursor, setCursor] = useNavigationState<number>("services:cursor", 0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const reload = useCallback(() => {
    stationApi.servicesList({ sessionId }).then((list) => {
      setServices(list);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    });
  }, [stationApi, sessionId, setCursor]);

  useEffect(() => {
    reload();
  }, [reload]);

  const hasItems = (services?.length ?? 0) > 0;

  useInput((input, key) => {
    if (openId || registering) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (input === "n") {
      setRegistering(true);
      return;
    }
    if (!services || services.length === 0) return;
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(services.length - 1, c + 1));
    if (key.return) {
      const selected = services[cursor];
      if (selected) setOpenId(selected.id);
    }
  });

  if (registering) {
    return (
      <ServiceForm
        stationId=""
        onBack={() => setRegistering(false)}
        onSaved={() => {
          setRegistering(false);
          reload();
        }}
      />
    );
  }

  if (openId) {
    return (
      <ServiceDetailScreen
        serviceId={openId}
        onBack={() => {
          setOpenId(null);
          reload();
        }}
      />
    );
  }

  const rows = (services ?? []).map((s) => ({
    name: s.name,
    blueprint: s.blueprint,
    status: s.status,
    instances: String(s.instances.length),
    "last install": s.lastInstalledAt ? s.lastInstalledAt.slice(0, 19).replace("T", " ") : "—",
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "services"]}
      footer={<HelpBar>↵ open n new esc back</HelpBar>}
    >
      {services === null ? <DimText>Loading...</DimText> : (
        <Table
          rows={rows}
          columns={[
            { key: "name" },
            { key: "blueprint" },
            { key: "status" },
            { key: "instances", align: "right" },
            { key: "last install" },
          ]}
          focusedIndex={hasItems ? cursor : undefined}
          emptyMessage="No services registered yet."
        />
      )}
    </ScreenFrame>
  );
}
