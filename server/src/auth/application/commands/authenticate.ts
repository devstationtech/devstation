import { Password } from "@server/auth/domain/models/password.ts";

export class Authenticate {
  constructor(private readonly _password: string) {}

  password(): Password {
    return new Password(this._password);
  }
}
