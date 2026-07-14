/// <reference types="@types/react" />
import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type {
  ProxmoxVirtualMachineMetricPoint as ProxmoxVirtualMachineMetricPointRecord,
  ProxmoxVirtualMachineRecord,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { useCluster } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  formatUptime,
  LineChart,
  ScreenFrame,
  Spinner,
  statusDot,
  TabBar,
} from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Timeframe = "hour" | "day" | "week";
const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: "hour", label: "1h" },
  { id: "day", label: "1d" },
  { id: "week", label: "7d" },
];
const REFRESH_MS = 30_000;

type Props = {
  clusterId: string;
  clusterName: string;
  nodeId: string;
  nodeName: string;
  vm: ProxmoxVirtualMachineRecord;
  proxmoxHost: string | null;
  onBack: () => void;
};

export function VirtualMachineDetailScreen(
  { clusterId, clusterName, nodeId, nodeName, vm: initialVirtualMachine, proxmoxHost, onBack }:
    Props,
) {
  const clusterApi = useCluster();
  const sessionId = useSessionId();
  const [vm, setVirtualMachine] = useState(initialVirtualMachine);

  const _refreshVirtualMachineRecord = useCallback(async () => {
    try {
      const list = await clusterApi.vmList({ sessionId, clusterId, nodeId });
      const updated = list.find((it) => it.id === vm.id);
      if (updated) setVirtualMachine(updated);
    } catch { /* keep stale record on transient failures */ }
  }, [clusterApi, sessionId, clusterId, nodeId, vm.id]);

  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout.columns ?? 120);
  useEffect(() => {
    const onResize = () => setCols(stdout.columns ?? 120);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const [timeframe, setTimeframe] = useState<Timeframe>("hour");
  const [points, setPoints] = useState<
    readonly ProxmoxVirtualMachineMetricPointRecord[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current;
    if (!silent) {
      setLoading(true);
      setPoints(null);
      setError(null);
    }
    try {
      const data = await clusterApi.vmMetrics({
        sessionId,
        clusterId,
        nodeId,
        virtualMachineId: vm.id,
        timeframe,
      });
      if (requestId !== requestIdRef.current) return; // stale response — newer request in flight
      setPoints(data);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError((err as Error).message);
    } finally {
      if (!silent && requestId === requestIdRef.current) setLoading(false);
    }
  }, [clusterApi, sessionId, clusterId, nodeId, vm.id, timeframe]);

  useEffect(() => {
    reload();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => reload(true), REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [reload]);

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.leftArrow) {
      const idx = TIMEFRAMES.findIndex((t) => t.id === timeframe);
      if (idx > 0) setTimeframe(TIMEFRAMES[idx - 1].id);
      return;
    }
    if (key.rightArrow) {
      const idx = TIMEFRAMES.findIndex((t) => t.id === timeframe);
      if (idx >= 0 && idx < TIMEFRAMES.length - 1) setTimeframe(TIMEFRAMES[idx + 1].id);
      return;
    }
  });

  const live = vm.resources.live;
  const tone = live?.status === "running" ? "ok" : live?.status === "stopped" ? "danger" : "muted";
  const proxmoxUrl = proxmoxHost
    ? `https://${proxmoxHost}:8006/#v1:0:=qemu%2F${vm.id}:4:::::::`
    : null;

  const summaryLine = (
    <Box gap={2}>
      <Text>
        {statusDot(tone)} <Text bold>{vm.name}</Text>
      </Text>
      <DimText>vmid {vm.id}</DimText>
      <DimText>{vm.ip}</DimText>
      {vm.tags.length > 0 && <DimText>{vm.tags.join(", ")}</DimText>}
      {live && <DimText>{live.status}</DimText>}
      {live && live.uptimeSeconds > 0 && <DimText>{formatUptime(live.uptimeSeconds)}</DimText>}
    </Box>
  );

  const servicesLine = vm.services.length === 0
    ? <DimText>no services installed</DimText>
    : (
      <Box gap={2}>
        <DimText>services:</DimText>
        {vm.services.map((s) => (
          <Text key={`${s.serviceId}-${s.role}`}>
            <Text>{s.serviceName}</Text>
            <DimText>· {s.role} · {s.installedAt.slice(0, 19).replace("T", " ")}</DimText>
          </Text>
        ))}
      </Box>
    );

  const header = (
    <Box flexDirection="column" gap={0}>
      {summaryLine}
      {servicesLine}
    </Box>
  );

  const tabBar = (
    <TabBar items={TIMEFRAMES.map((t) => ({ id: t.id, label: t.label }))} currentId={timeframe} />
  );

  const proxmoxLink = proxmoxUrl ? hyperlink("open in proxmox ↗", proxmoxUrl) : "";
  const helpText = `←→ timeframe   esc back${proxmoxLink ? `   ${proxmoxLink}` : ""}`;

  return (
    <ScreenFrame
      breadcrumb={["topologies", clusterName, nodeName, "virtual machines", vm.name]}
      header={header}
      topRight={tabBar}
      footer={<HelpBar>{helpText}</HelpBar>}
    >
      {loading && points === null
        ? <Spinner label="loading metrics..." />
        : error
        ? <Text color="red">✗ {error}</Text>
        : points === null || points.length === 0
        ? <DimText>No metrics available for this timeframe.</DimText>
        : <ChartsBody points={points} cols={cols} timeframe={timeframe} />}
    </ScreenFrame>
  );
}

function ChartsBody(
  { points, cols, timeframe }: {
    points: readonly ProxmoxVirtualMachineMetricPointRecord[];
    cols: number;
    timeframe: Timeframe;
  },
) {
  const cpuSeries = points.map((p) => p.cpuPercent);
  const ramUsedSeries = points.map((p) => p.ramUsedGiB);
  const ramTotalSeries = points.map((p) => p.ramTotalGiB);
  const diskReadSeries = points.map((p) => p.diskReadMBs);
  const diskWriteSeries = points.map((p) => p.diskWriteMBs);
  const netInSeries = points.map((p) => p.netInMBs);
  const netOutSeries = points.map((p) => p.netOutMBs);

  // X-axis ticks: span = full timeframe, oldest on the left, "now" on right.
  const xTicks: string[] = timeframe === "hour"
    ? ["1h", "30m", "now"]
    : timeframe === "day"
    ? ["24h", "12h", "now"]
    : ["7d", "3d", "now"];

  // Two columns need 2*40 + chrome (~6) + gap (~3) ≈ 89 cols. Below that, stack vertically.
  const TWO_COL_THRESHOLD = 89;
  const stacked = cols < TWO_COL_THRESHOLD;
  const chartWidth = stacked
    ? Math.max(20, cols - 6)
    : Math.max(40, Math.floor((cols - 6 - 3) / 2));

  const cpuChart = (
    <Box width={chartWidth} flexDirection="column">
      <LineChart
        title="cpu (%)"
        height={5}
        maxWidth={chartWidth}
        series={[{ data: cpuSeries, color: "cyan", label: "cpu%" }]}
        formatValue={(n) => `${n.toFixed(0)}%`}
        xTicks={xTicks}
      />
    </Box>
  );

  const ramChart = (
    <Box width={chartWidth} flexDirection="column">
      <LineChart
        title="ram (gib)"
        height={5}
        maxWidth={chartWidth}
        series={[
          { data: ramUsedSeries, color: "green", label: "used" },
          { data: ramTotalSeries, color: "lightcyan", label: "total" },
        ]}
        formatValue={(n) => `${n.toFixed(1)}G`}
        xTicks={xTicks}
      />
    </Box>
  );

  const diskChart = (
    <Box width={chartWidth} flexDirection="column">
      <LineChart
        title="disk i/o (mb/s)"
        height={5}
        maxWidth={chartWidth}
        series={[
          { data: diskReadSeries, color: "blue", label: "read" },
          { data: diskWriteSeries, color: "magenta", label: "write" },
        ]}
        formatValue={(n) => `${n.toFixed(2)}`}
        xTicks={xTicks}
      />
    </Box>
  );

  const netChart = (
    <Box width={chartWidth} flexDirection="column">
      <LineChart
        title="network (mb/s)"
        height={5}
        maxWidth={chartWidth}
        series={[
          { data: netInSeries, color: "yellow", label: "in" },
          { data: netOutSeries, color: "lightgreen", label: "out" },
        ]}
        formatValue={(n) => `${n.toFixed(2)}`}
        xTicks={xTicks}
      />
    </Box>
  );

  if (stacked) {
    return (
      <Box flexDirection="column" gap={1}>
        {cpuChart}
        {ramChart}
        {diskChart}
        {netChart}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={3}>
        {cpuChart}
        {ramChart}
      </Box>
      <Box gap={3}>
        {diskChart}
        {netChart}
      </Box>
    </Box>
  );
}

// OSC 8 hyperlink — supported by iTerm2, Kitty, GNOME Terminal, VS Code, Windows Terminal, modern xterm.
// Falls back to plain text in unsupported terminals.
function hyperlink(label: string, url: string): string {
  return `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`;
}
