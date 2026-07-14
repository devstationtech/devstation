import type { Command } from "@server/images/domain/ports/inbound/command.ts";

export class ForgetImageUsage implements Command {
  constructor(
    readonly imageId: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}
