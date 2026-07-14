import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

/**
 * Operator acknowledges that a node in a transient FSM state was
 * interrupted (process crash / restart). The handler demotes it to
 * the matching `*_FAILED` so retry / replan / destroy become valid again.
 */
export class AcknowledgeInterruption implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}
