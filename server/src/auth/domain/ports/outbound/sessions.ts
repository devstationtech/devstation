import type { Session } from "@server/auth/domain/models/session.ts";

export interface Sessions {
  save(session: Session): void;
  get(id: string): Session;
  active(): Session;
}
