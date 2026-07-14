import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";

export class UpdateNode implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeId: string,
    readonly name: string,
    readonly ip: string,
    readonly vaultId: string,
    readonly usernameSecretId: string,
    readonly passwordSecretId: string,
  ) {}
}
