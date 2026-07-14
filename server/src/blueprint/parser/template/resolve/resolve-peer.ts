import type { ResolveContext } from "@server/blueprint/parser/template/resolve/resolve-context.ts";

/**
 * Resolves a `peer.<role>[<i>].<field>` placeholder against the runtime
 * Context. Accepts both indexed (`peer.server[0].host`) and sugar
 * (`peer.server.host`, equivalent to `[0]`) forms.
 */
export function resolvePeer(rest: string, rc: ResolveContext): string {
  const indexed = /^([a-zA-Z0-9_-]+)\[(\d+)\]\.(.+)$/.exec(rest);
  const sugar = /^([a-zA-Z0-9_-]+)\.(.+)$/.exec(rest);

  let roleName: string;
  let index: number;
  let field: string;

  if (indexed) {
    [, roleName, , field] = indexed;
    index = Number.parseInt(indexed[2]);
  } else if (sugar) {
    [, roleName, field] = sugar;
    index = 0;
  } else {
    throw new Error(
      `template 'peer.${rest}': expected peer.<role>[<i>].<field> or peer.<role>.<field>`,
    );
  }

  const peers = rc.ctx.fromRole(roleName).all();
  if (index < 0 || index >= peers.length) {
    throw new Error(
      `template 'peer.${rest}': role '${roleName}' has ${peers.length} peer(s), index ${index} out of range`,
    );
  }
  const peer = peers[index];

  if (field === "host") return peer.host;
  if (field.startsWith("secrets.")) {
    const name = field.slice("secrets.".length);
    const value = peer.secrets[name];
    if (value === undefined) {
      throw new Error(
        `template 'peer.${rest}': peer of role '${roleName}' did not publish secret '${name}'`,
      );
    }
    return value;
  }
  if (field.startsWith("outputs.")) {
    const name = field.slice("outputs.".length);
    const value = peer.outputs[name];
    if (value === undefined) {
      throw new Error(
        `template 'peer.${rest}': peer of role '${roleName}' did not publish output '${name}'`,
      );
    }
    return value;
  }
  throw new Error(`template 'peer.${rest}': unknown field '${field}'`);
}
