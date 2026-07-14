import type { Command } from "@server/images/domain/ports/inbound/command.ts";

export class RegisterImage implements Command {
  constructor(
    readonly name: string,
    readonly os: string,
    readonly sourceUrl: string,
    readonly user: string,
    readonly host: string,
  ) {}
}
