/**
 * Throws when `value` is not a plain object (mapping). Arrays and `null` are
 * rejected.
 */
export function mapping(
  { value, where }: { value: unknown; where: string },
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where}: required mapping`);
  }
  return value as Record<string, unknown>;
}
