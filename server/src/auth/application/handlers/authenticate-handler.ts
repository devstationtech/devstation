import { Session } from "@server/auth/domain/models/session.ts";
import { AuthenticationFailed } from "@server/auth/domain/exceptions/authentication-failed.ts";
import type { Authenticate } from "@server/auth/application/commands/authenticate.ts";
import type { Auth } from "@server/auth/domain/ports/outbound/auth.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";

export class AuthenticateHandler {
  constructor(
    private readonly auth: Auth,
    private readonly sessions: Sessions,
  ) {}

  async handle(command: Authenticate): Promise<Session> {
    const key = await this.auth.authenticate(command.password());
    if (!key) throw new AuthenticationFailed();
    const opened = Session.open(key);
    this.sessions.save(opened);
    return opened;
  }
}
