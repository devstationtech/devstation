import { ProvisioningPlanParseFailed } from "@server/cluster/outbound/executions/proxmox/provisioning/errors.ts";

type RawResourceChange = {
  address: string;
  change: {
    actions: string[];
  };
};

type RawPlan = {
  resource_changes?: RawResourceChange[];
};

export type PlanCounts = {
  toCreate: number;
  toUpdate: number;
  toDelete: number;
};

type Action = "create" | "update" | "delete";

const VM_MODULE_PATTERN = /module\.vm\["([^"]+)"\]/;

export function parsePlanJson(json: string): PlanCounts {
  let plan: RawPlan;
  try {
    plan = JSON.parse(json) as RawPlan;
  } catch (error) {
    throw new ProvisioningPlanParseFailed(error instanceof Error ? error.message : "invalid json");
  }

  const seen = new Set<string>();
  let toCreate = 0;
  let toUpdate = 0;
  let toDelete = 0;

  for (const rc of plan.resource_changes ?? []) {
    const hostname = extractHostname(rc.address);
    if (!hostname) continue;

    const action = mapAction(rc.change.actions);
    if (!action) continue;

    const key = `${action}:${hostname}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (action === "create") toCreate++;
    else if (action === "update") toUpdate++;
    else toDelete++;
  }

  return { toCreate, toUpdate, toDelete };
}

function extractHostname(address: string): string | null {
  const match = address.match(VM_MODULE_PATTERN);
  return match ? match[1] : null;
}

function mapAction(actions: string[]): Action | null {
  if (actions.length === 0) return null;
  if (actions.includes("no-op")) return null;
  if (actions.includes("create") && actions.includes("delete")) return "update";
  if (actions.includes("update")) return "update";
  if (actions.includes("create")) return "create";
  if (actions.includes("delete")) return "delete";
  return null;
}
