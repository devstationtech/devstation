import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class UnregisterAllNodes implements Command {
  constructor(readonly clusterId: string) {}
}
