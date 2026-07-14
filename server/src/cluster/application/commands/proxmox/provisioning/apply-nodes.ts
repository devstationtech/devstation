import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class ApplyNodes implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeIds: string[] = [],
  ) {}
}
