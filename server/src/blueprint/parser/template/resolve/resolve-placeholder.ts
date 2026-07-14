import type { ResolveContext } from "@server/blueprint/parser/template/resolve/resolve-context.ts";
import { resolvePeer } from "@server/blueprint/parser/template/resolve/resolve-peer.ts";

/**
 * Dispatches one trimmed placeholder expression to the right resolver.
 * Recognised forms:
 *
 *   role | host                    direct context fields
 *   inputs.X                       user-supplied input X
 *   peer.<role>[<i>].<field>       peer access (delegated to resolvePeer)
 *
 * `${secrets.X}` is intentionally *not* handled here — secrets are async and
 * must be pre-resolved before this synchronous resolver runs.
 */
export function resolvePlaceholder(expression: string, rc: ResolveContext): string {
  if (expression === "role") return rc.ctx.role.name;
  if (expression === "host") return rc.host;
  if (expression.startsWith("inputs.")) {
    return String(rc.ctx.inputs.string(expression.slice("inputs.".length)));
  }
  if (expression.startsWith("secrets.")) {
    throw new Error(
      `template '${expression}': secrets are async — preresolveSecrets must run before resolve`,
    );
  }
  if (expression.startsWith("peer.")) {
    return resolvePeer(expression.slice("peer.".length), rc);
  }
  throw new Error(`unknown template placeholder: \${${expression}}`);
}
