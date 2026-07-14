/**
 * Throws when `value` is not a non-empty string. The `where` argument is the
 * contextual YAML path (e.g. `argocd.steps[0].verify.run`) so error messages
 * point straight at the offending key.
 */
export function string({ value, where }: { value: unknown; where: string }): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${where}: required non-empty string`);
  }
  return value;
}
