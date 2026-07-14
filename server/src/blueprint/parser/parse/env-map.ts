/**
 * Parses the optional `env:` mapping on a step. Values stay as raw strings
 * — the compiler later runs them through the template engine alongside the
 * shell body itself.
 */
export function envMap(
  { raw, where }: { raw: unknown; where: string },
): Record<string, string> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${where}.env: must be a mapping of string to string`);
  }
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") {
      throw new Error(`${where}.env.${key}: must be a string`);
    }
    env[key] = value;
  }
  return env;
}
