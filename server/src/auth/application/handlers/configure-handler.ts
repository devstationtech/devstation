import { Session } from "@server/auth/domain/models/session.ts";
import type { Configure } from "@server/auth/application/commands/configure.ts";
import type { Auth } from "@server/auth/domain/ports/outbound/auth.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";
import { AlreadyConfigured } from "@server/auth/domain/exceptions/already-configured.ts";

export class ConfigureHandler {
  constructor(
    private readonly auth: Auth,
    private readonly sessions: Sessions,
  ) {}

  /**
   * First-time setup only. Reconfiguring would mint a new salt+key and
   * strand every secret already encrypted under the old key (and any
   * live token would still decrypt them), so an existing configuration
   * is a hard conflict — rotation is a separate, re-encrypting flow.
   */
  async handle(command: Configure): Promise<Session> {
    if (await this.auth.isConfigured()) throw new AlreadyConfigured();
    const key = await this.auth.configure(command.password());
    const opened = Session.open(key);
    this.sessions.save(opened);
    return opened;
  }
}
