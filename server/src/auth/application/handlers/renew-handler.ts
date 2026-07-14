import type { Session } from "@server/auth/domain/models/session.ts";
import type { Renew } from "@server/auth/application/commands/renew.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";

export class RenewHandler {
  constructor(private readonly sessions: Sessions) {}

  // deno-lint-ignore require-await -- uniform async handler contract; renew itself is synchronous
  async handle(command: Renew): Promise<Session> {
    const session = this.sessions.get(command.sessionId);
    const renewed = session.renew();
    this.sessions.save(renewed);
    return renewed;
  }
}
