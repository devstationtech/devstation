import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class AssignImage implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeId: string,
    readonly imageId: string,
    readonly virtualMachineId: number,
    readonly storage: string,
    // Point-in-time snapshot of the catalog image, sent by the UI that listed
    // it from the central `images` catalog. The node keeps this snapshot so the
    // catalog and the assignment have independent lifecycles.
    readonly name: string,
    readonly os: string,
    readonly sourceUrl: string,
  ) {}
}
