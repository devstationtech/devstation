/** Throws when `value` is not a finite number. */
export function number({ value, where }: { value: unknown; where: string }): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where}: required number`);
  }
  return value;
}
