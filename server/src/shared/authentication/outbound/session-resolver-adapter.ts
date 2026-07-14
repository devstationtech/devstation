import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";
import type { RetrieveSessionHandler } from "@server/auth/application/handlers/retrieve-session-handler.ts";

export class SessionResolverAdapter implements SessionResolver {
  constructor(private readonly handler: RetrieveSessionHandler) {}

  resolve(): string {
    return this.handler.handle();
  }
}
