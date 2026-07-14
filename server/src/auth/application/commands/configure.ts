import { Password } from "@server/auth/domain/models/password.ts";

export class Configure {
  constructor(private readonly _password: string) {}

  password(): Password {
    // Setting (or rotating) the master password applies the strong policy;
    // `Authenticate` keeps the legacy floor so existing installs still log in.
    return Password.strong(this._password);
  }
}
