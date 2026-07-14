/**
 * Resolves the "actor" (user + hostname) attached to a mutating
 * command when invoked via MCP.
 *
 * Every state-changing MCP endpoint historically required `user` and
 * `hostname` args, so when an LLM agent called the tool it would fill
 * them with strings like `"unknown"` — corrupting the audit trail.
 * The LLM has no way to know who's at the keyboard.
 *
 * The right source is the engine process itself: MCP is spawned by
 * the user's client (Claude Code / Desktop) under the user's
 * identity, so `$USER` / `$USERNAME` and `Deno.hostname()` are
 * authoritative. We still accept caller-supplied values for
 * RPC-via-MCP parity and for tests, but it's no longer required.
 *
 * Falls back to `"devstation"` / `"unknown"` only when both env
 * lookups and the system call fail — never throws, since refusing
 * to register a cluster over missing audit metadata would be worse
 * than recording a generic actor.
 */
import { osHostname, osUser } from "@server/shared/platform/identity.ts";

export interface ActorArgs {
  readonly user?: string;
  readonly hostname?: string;
}

export interface Actor {
  readonly user: string;
  readonly hostname: string;
}

export function resolveActor(args: ActorArgs = {}): Actor {
  const user = nonEmpty(args.user) ?? osUser() ?? "devstation";

  const hostname = nonEmpty(args.hostname) ?? osHostname();
  return { user, hostname: hostname ?? "unknown" };
}

function nonEmpty(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
