import type { Command } from "@server/size/domain/ports/inbound/command.ts";

export class RegisterSize implements Command {
  constructor(
    readonly name: string,
    readonly provider: string,
    readonly cpu: number,
    readonly ram: number,
    readonly disk: number,
    readonly user: string,
    readonly host: string,
  ) {}
}
