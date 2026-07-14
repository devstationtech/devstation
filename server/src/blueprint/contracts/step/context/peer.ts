/**
 * One peer the current role can read from via `ctx.fromRole(name)`. Carries
 * the peer's identity (role + host) plus what it published (`secrets`,
 * `outputs`). Populated by the installer as roles complete in declared order.
 */
export type Peer = {
  readonly role: { readonly name: string };
  readonly host: string;
  readonly secrets: Readonly<Record<string, string>>;
  readonly outputs: Readonly<Record<string, string>>;
};
