import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class RegisterCluster implements Command {
  constructor(
    readonly name: string,
    readonly user: string,
    readonly host: string,
  ) {}
}
