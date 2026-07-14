import type { Command } from "@server/images/domain/ports/inbound/command.ts";

export class RecordImageUsage implements Command {
  constructor(
    readonly imageId: string,
    readonly clusterId: string,
    readonly clusterName: string,
    readonly nodeId: string,
    readonly nodeName: string,
  ) {}
}
