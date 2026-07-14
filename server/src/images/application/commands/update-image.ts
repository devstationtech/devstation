import type { Command } from "@server/images/domain/ports/inbound/command.ts";

export class UpdateImage implements Command {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly os: string,
    readonly sourceUrl: string,
  ) {}
}
