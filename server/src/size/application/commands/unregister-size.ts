import type { Command } from "@server/size/domain/ports/inbound/command.ts";

export class UnregisterSize implements Command {
  constructor(readonly id: string) {}
}
