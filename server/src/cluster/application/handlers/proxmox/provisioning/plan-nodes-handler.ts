import type { PlanNodes } from "@server/cluster/application/commands/proxmox/provisioning/plan-nodes.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Provisioning } from "@server/cluster/domain/ports/outbound/executions/proxmox/provisioning/provisioning.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import {
  type ProvisioningPhase,
  ProvisioningRun,
} from "@server/cluster/application/handlers/proxmox/provisioning/provisioning-run.ts";

const PLAN: ProvisioningPhase = {
  start: (c, n) => c.startPlan(n),
  complete: (c, n) => c.completePlan(n),
  fail: (c, n) => c.failPlan(n),
  task: (p, snapshot, n) => p.plan(snapshot, [n]),
};

export class PlanNodesHandler {
  private readonly run: ProvisioningRun;

  constructor(
    clusters: Clusters,
    executions: Executions,
    provisioning: Provisioning,
    dispatcher: Dispatcher,
  ) {
    this.run = new ProvisioningRun(clusters, executions, provisioning, dispatcher);
  }

  handle(command: PlanNodes): Promise<Execution> {
    return this.run.start(command.clusterId, command.nodeIds, PLAN);
  }
}
