/**
 * Host identity reads, centralized so inbound/application code never
 * touches the runtime API directly. POSIX favors $USER, Windows $USERNAME;
 * hostname needs --allow-sys and degrades to null without it.
 */
export function osUser(): string | null {
  return nonEmpty(Deno.env.get("USER")) ?? nonEmpty(Deno.env.get("USERNAME"));
}

export function osHostname(): string | null {
  try {
    return nonEmpty(Deno.hostname());
  } catch {
    return null;
  }
}

function nonEmpty(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
