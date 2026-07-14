/// <reference types="@types/react" />
import { Text, useInput } from "ink";
import { ScreenFrame } from "@ui/shared/design-system/mod.ts";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ProxmoxClusterDetailScreen } from "@ui/cluster/providers/proxmox/cluster-detail.tsx";

type Props = {
  clusterId: string;
  clusterName: string;
  provider: string;
  onBack: () => void;
};

export function ClusterDetailScreen({ clusterId, clusterName, provider, onBack }: Props) {
  if (provider === "proxmox") {
    return (
      <ProxmoxClusterDetailScreen
        clusterId={clusterId}
        clusterName={clusterName}
        onBack={onBack}
      />
    );
  }

  return (
    <UnsupportedProviderScreen
      clusterName={clusterName}
      provider={provider}
      onBack={onBack}
    />
  );
}

type UnsupportedProps = { clusterName: string; provider: string; onBack: () => void };

function UnsupportedProviderScreen({ clusterName, provider, onBack }: UnsupportedProps) {
  useInput((_input, key) => {
    if (key.escape || key.return) onBack();
  });

  return (
    <ScreenFrame
      breadcrumb={["topologies", clusterName]}
      footer={<HelpBar>esc back</HelpBar>}
    >
      <Text color="red">Unsupported provider: {provider}</Text>
    </ScreenFrame>
  );
}
