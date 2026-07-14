import type { DestroyNodes } from "@server/cluster/application/commands/proxmox/provisioning/destroy-nodes.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Provisioning } from "@server/cluster/domain/ports/outbound/executions/proxmox/provisioning/provisioning.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import {
  type ProvisioningPhase,
  ProvisioningRun,
} from "@server/cluster/application/handlers/proxmox/provisioning/provisioning-run.ts";

const DESTROY: ProvisioningPhase = {
  start: (c, n) => c.startDestroy(n),
  complete: (c, n) => c.completeDestroy(n),
  fail: (c, n) => c.failDestroy(n),
  task: (p, snapshot, n) => p.destroy(snapshot, [n]),
};

export class DestroyNodesHandler {
  private readonly run: ProvisioningRun;

  constructor(
    clusters: Clusters,
    executions: Executions,
    provisioning: Provisioning,
    dispatcher: Dispatcher,
  ) {
    this.run = new ProvisioningRun(clusters, executions, provisioning, dispatcher);
  }

  handle(command: DestroyNodes): Promise<Execution> {
    return this.run.start(command.clusterId, command.nodeIds, DESTROY);
  }
}
