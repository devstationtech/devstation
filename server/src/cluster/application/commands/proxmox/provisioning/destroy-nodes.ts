import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class DestroyNodes implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeIds: string[] = [],
  ) {}
}
