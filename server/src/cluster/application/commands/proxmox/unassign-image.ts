import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class UnassignImage implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeId: string,
    readonly imageId: string,
  ) {}
}
