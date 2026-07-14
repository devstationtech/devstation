import type { ApplyNodes } from "@server/cluster/application/commands/proxmox/provisioning/apply-nodes.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Provisioning } from "@server/cluster/domain/ports/outbound/executions/proxmox/provisioning/provisioning.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import {
  type ProvisioningPhase,
  ProvisioningRun,
} from "@server/cluster/application/handlers/proxmox/provisioning/provisioning-run.ts";

const APPLY: ProvisioningPhase = {
  start: (c, n) => c.startApply(n),
  complete: (c, n) => c.completeApply(n),
  fail: (c, n) => c.failApply(n),
  task: (p, snapshot, n) => p.apply(snapshot, [n]),
};

export class ApplyNodesHandler {
  private readonly run: ProvisioningRun;

  constructor(
    clusters: Clusters,
    executions: Executions,
    provisioning: Provisioning,
    dispatcher: Dispatcher,
  ) {
    this.run = new ProvisioningRun(clusters, executions, provisioning, dispatcher);
  }

  handle(command: ApplyNodes): Promise<Execution> {
    return this.run.start(command.clusterId, command.nodeIds, APPLY);
  }
}
