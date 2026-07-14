import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
import { resolve } from "@server/blueprint/parser/template/resolve/resolve.ts";
import { preresolveSecrets } from "@server/blueprint/parser/template/secrets.ts";
import { shellQuote } from "@server/station/outbound/installer/proxmox/runner/shell-quote.ts";

/**
 * Resolves templates in a shell body and prepends `export KEY=VALUE` lines
 * for any declared environment variables. Both the body and env values run
 * through `preresolveSecrets` and `resolve`, so they share the same template
 * vocabulary.
 */
export async function renderShell(
  { body, env, ctx }: {
    body: string;
    env: Readonly<Record<string, string>>;
    ctx: StepContext;
  },
): Promise<string> {
  const resolvedBody = resolve(await preresolveSecrets(body, ctx), { ctx, host: ctx.host });

  if (Object.keys(env).length === 0) return resolvedBody;

  const exports = await Promise.all(
    Object.entries(env).map(async ([key, raw]) => {
      const resolved = resolve(await preresolveSecrets(raw, ctx), { ctx, host: ctx.host });
      return `export ${key}=${shellQuote(resolved)}`;
    }),
  );

  return `${exports.join("\n")}\n${resolvedBody}`;
}
