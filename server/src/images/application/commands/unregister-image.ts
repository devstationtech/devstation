import type { Command } from "@server/images/domain/ports/inbound/command.ts";

export class UnregisterImage implements Command {
  constructor(readonly id: string) {}
}
