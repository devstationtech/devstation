import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class DisconnectCluster implements Command {
  constructor(readonly clusterId: string) {}
}
