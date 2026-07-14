import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class UpdateAssignedImage implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeId: string,
    readonly imageId: string,
    readonly virtualMachineId: number,
    readonly storage: string,
  ) {}
}
