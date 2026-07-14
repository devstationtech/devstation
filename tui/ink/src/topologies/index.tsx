/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import { useInput } from "ink";
import { ClusterScreen } from "@ui/cluster/index.tsx";
import { SizeScreen } from "@ui/size/index.tsx";
import { ImagesScreen } from "@ui/images/index.tsx";
import { BlueprintScreen } from "@ui/blueprint/index.tsx";
import { StationScreen } from "@ui/station/index.tsx";
import { VaultScreen } from "@ui/vault/index.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { Confirm, ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { useAnyRun } from "@ui/shared/hooks/use-active-runs.ts";
import {
  useBlueprint,
  useCluster,
  useImage,
  useSize,
  useStation,
  useVault,
} from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type Resource =
  | "clusters"
  | "sizes"
  | "images"
  | "blueprints"
  | "stations"
  | "vaults";

type Counts = {
  clusters: number;
  clustersConnected: number;
  sizes: number;
  images: number;
  blueprints: number;
  stations: number;
  vaults: number;
} | null;

const RESOURCES: { id: Resource; label: string; description: string }[] = [
  { id: "clusters", label: "clusters", description: "clusters (hypervisor)" },
  { id: "sizes", label: "sizing", description: "instance sizes" },
  { id: "images", label: "images", description: "OS image catalog" },
  {
    id: "blueprints",
    label: "blueprints",
    description: "blueprint catalog (installable recipes)",
  },
  {
    id: "stations",
    label: "stations",
    description: "service topologies (groups of services orchestrated together)",
  },
  { id: "vaults", label: "vaults", description: "secret vaults" },
];

type Props = {
  onBack: () => void;
};

export function TopologiesScreen({ onBack }: Props) {
  const [resource, setResource] = useState<Resource | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [highlighted, setHighlighted] = useNavigationState<Resource>(
    "topologies:highlighted",
    "clusters",
  );
  const [counts, setCounts] = useState<Counts>(null);
  const anyRunning = useAnyRun();
  const clusterApi = useCluster();
  const sizeApi = useSize();
  const imageApi = useImage();
  const blueprintApi = useBlueprint();
  const stationApi = useStation();
  const vault = useVault();
  const sessionId = useSessionId();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      clusterApi.list({ sessionId }),
      sizeApi.list({ sessionId }),
      imageApi.list({ sessionId }),
      blueprintApi.list({ sessionId }),
      stationApi.list({ sessionId }),
      vault.listVaults({ sessionId }),
    ])
      .then(([cls, defs, imgs, bps, stns, vlts]) => {
        if (cancelled) return;
        setCounts({
          clusters: cls.length,
          clustersConnected: cls.filter((c) => c.connected).length,
          sizes: defs.length,
          images: imgs.length,
          blueprints: bps.length,
          stations: stns.length,
          vaults: vlts.length,
        });
      })
      .catch(() => {/* AuthGate handles session-expired */});
    return () => {
      cancelled = true;
    };
  }, [
    resource,
    clusterApi,
    sizeApi,
    imageApi,
    blueprintApi,
    stationApi,
    vault,
    sessionId,
  ]);

  const cursor = Math.max(0, RESOURCES.findIndex((r) => r.id === highlighted));

  useInput((_input, key) => {
    if (resource !== null) return;
    if (confirmingExit) return;
    if (key.escape) {
      if (anyRunning) setConfirmingExit(true);
      else onBack();
      return;
    }
    if (key.upArrow) {
      const next = Math.max(0, cursor - 1);
      setHighlighted(RESOURCES[next].id);
      return;
    }
    if (key.downArrow) {
      const next = Math.min(RESOURCES.length - 1, cursor + 1);
      setHighlighted(RESOURCES[next].id);
      return;
    }
    if (key.return) {
      setResource(RESOURCES[cursor].id);
      return;
    }
  });

  if (resource === "clusters") return <ClusterScreen onBack={() => setResource(null)} />;
  if (resource === "sizes") return <SizeScreen onBack={() => setResource(null)} />;
  if (resource === "images") return <ImagesScreen onBack={() => setResource(null)} />;
  if (resource === "blueprints") return <BlueprintScreen onBack={() => setResource(null)} />;
  if (resource === "stations") return <StationScreen onBack={() => setResource(null)} />;
  if (resource === "vaults") return <VaultScreen onBack={() => setResource(null)} />;

  const statisticsFor = (id: Resource): string => {
    if (!counts) return "...";
    if (id === "clusters") {
      return counts.clustersConnected > 0
        ? `${counts.clusters} registered, ${counts.clustersConnected} connected`
        : `${counts.clusters} registered`;
    }
    if (id === "sizes") return `${counts.sizes} registered`;
    if (id === "images") return `${counts.images} registered`;
    if (id === "blueprints") return `${counts.blueprints} registered`;
    if (id === "stations") return `${counts.stations} registered`;
    return `${counts.vaults} registered`;
  };

  const rows = RESOURCES.map((r) => ({
    resource: r.label,
    description: r.description,
    statistics: statisticsFor(r.id),
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies"]}
      footer={<HelpBar>↵ open esc back</HelpBar>}
    >
      {confirmingExit
        ? (
          <Confirm
            intent="warning"
            question="Provisioning is in progress. Leaving will interrupt running operations. Continue?"
            confirmWord="leave"
            onConfirm={onBack}
            onCancel={() => setConfirmingExit(false)}
          />
        )
        : counts === null
        ? <DimText>Loading...</DimText>
        : (
          <Table
            rows={rows}
            columns={[
              { key: "resource" },
              { key: "description" },
              { key: "statistics", align: "right" },
            ]}
            focusedIndex={cursor}
            emptyMessage=""
          />
        )}
    </ScreenFrame>
  );
}
