import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";

export class RetrieveSessionHandler {
  constructor(private readonly sessions: Sessions) {}

  handle(): string {
    return this.sessions.active().key.value;
  }
}
