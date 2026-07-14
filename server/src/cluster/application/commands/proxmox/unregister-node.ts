import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class UnregisterNode implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}
