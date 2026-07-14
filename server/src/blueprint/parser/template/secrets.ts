import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";

const SECRET_PLACEHOLDER = /\$\{secrets\.([^}]+)\}/g;

/**
 * Replaces every `${secrets.X}` placeholder with its resolved value from the
 * vault. Runs as a pre-pass before the synchronous `resolve(...)` so the rest
 * of the template engine stays sync.
 */
export async function preresolveSecrets(
  template: string,
  ctx: StepContext,
): Promise<string> {
  const matches = [...template.matchAll(SECRET_PLACEHOLDER)];
  let result = template;
  for (const match of matches) {
    const secretName = match[1].trim();
    const value = await ctx.secrets.get(secretName);
    result = result.replaceAll(match[0], value);
  }
  return result;
}
