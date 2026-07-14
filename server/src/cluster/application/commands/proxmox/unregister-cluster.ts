import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class UnregisterCluster implements Command {
  constructor(readonly id: string) {}
}
