/**
 * Reading the live lab. Resolves the real cluster (default `homelab`,
 * override via `DEVSTATION_TEST_CLUSTER`) and its first node by reading the
 * catalog — nothing hardcoded — so cluster/infra tests can target whatever
 * is configured and skip when nothing is.
 */
import type { McpClient } from "@mcp-test-harness-ts/mod.ts";

export interface ClusterSummary {
  readonly id: string;
  readonly name: string;
}
export interface NodeSummary {
  readonly id: string;
  readonly name: string;
}
export interface ConnectionSummary {
  readonly host: string;
  readonly vaultId: string;
  readonly secretId: string;
}

/** The live cluster + its first node, or `null` parts when none is configured. */
export async function resolveLive(
  client: McpClient,
  clusterName = Deno.env.get("DEVSTATION_TEST_CLUSTER") || "homelab",
): Promise<{ cluster: ClusterSummary | null; node: NodeSummary | null }> {
  const clusters = await client.parsed<ClusterSummary[]>("devstation_cluster_list", {});
  const cluster = clusters.find((c) => c.name === clusterName) ?? clusters[0] ?? null;
  if (!cluster) return { cluster: null, node: null };
  const nodes = await client.parsed<NodeSummary[]>(
    "devstation_cluster_nodes_list",
    { clusterId: cluster.id },
  );
  return { cluster, node: nodes[0] ?? null };
}
