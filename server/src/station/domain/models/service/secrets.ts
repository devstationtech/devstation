import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

/**
 * Blueprint-level secrets the service exposes to step functions at install time.
 * Maps the local name a stack author uses (e.g. `"docker-registry-token"`)
 * to a `Secret` VO pointing at the actual entry in the service's vault.
 *
 * Unlike per-instance credentials (which live on each `Instance`), these are
 * service-wide — the same token is read by every step regardless of role or
 * host.
 */
export class Secrets implements ValueObject {
  private readonly map: ReadonlyMap<string, Secret>;

  constructor(entries: Readonly<Record<string, Secret>>) {
    this.map = new Map(Object.entries(entries));
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  get(name: string): Secret {
    const secret = this.map.get(name);
    if (!secret) throw new Error(`secret '${name}' is not registered on the service.`);
    return secret;
  }

  names(): string[] {
    return [...this.map.keys()];
  }

  toRecord(): Record<string, Secret> {
    return Object.fromEntries(this.map);
  }
}
