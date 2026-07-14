/**
 * How a VM is cloned from its template.
 *
 *   AUTO   — decide per target datastore type: CoW storage (ZFS,
 *            lvm-thin, btrfs, rbd) → linked; everything else → full.
 *   LINKED — force copy-on-write clone (no template-disk copy).
 *   FULL   — force full clone (duplicates the template disk).
 *
 * Wire/config value is the lowercase string (consistent with the
 * `Provider` enum precedent).
 */
export enum CloneStrategy {
  AUTO = "auto",
  LINKED = "linked",
  FULL = "full",
}

export function cloneStrategyFrom(value: string | undefined): CloneStrategy {
  if (value === undefined || value === "") return CloneStrategy.AUTO;
  const match = Object.values(CloneStrategy).find((s) => s === value);
  if (!match) {
    throw new Error(
      `clone strategy must be one of ${Object.values(CloneStrategy).join(", ")}.`,
    );
  }
  return match;
}
