import type { ResolveContext } from "@server/blueprint/parser/template/resolve/resolve-context.ts";
import { resolvePlaceholder } from "@server/blueprint/parser/template/resolve/resolve-placeholder.ts";

const PLACEHOLDER = /\$\{([^}]+)\}/g;

/**
 * Resolves `${...}` placeholders in `template` against a step's runtime
 * Context, synchronously. `${file:...}` was already inlined at parse time;
 * `${secrets.X}` should already be inlined by `preresolveSecrets` before
 * this runs.
 */
export function resolve(template: string, rc: ResolveContext): string {
  return template.replace(PLACEHOLDER, (_match, expression: string) => {
    return resolvePlaceholder(expression.trim(), rc);
  });
}
