import { CloneStrategy } from "@server/cluster/domain/models/proxmox/connection/clone-strategy.ts";

/**
 * Proxmox storage backends that support copy-on-write linked clones.
 * Anything else (LVM puro, dir/raw, NFS) requires a full clone.
 */
const COW: ReadonlySet<string> = new Set(["zfspool", "lvmthin", "btrfs", "rbd"]);

/**
 * Resolve whether a VM should be linked-cloned.
 *
 * - `LINKED` / `FULL` force the answer.
 * - `AUTO` decides by the target datastore type. An unknown or
 *   unresolved type (`null`) falls back to **full** — correctness over
 *   space: full clone works on every backend; a linked clone on a
 *   non-CoW storage fails hard.
 */
export function isLinked(
  storageType: string | null,
  strategy: CloneStrategy,
): boolean {
  if (strategy === CloneStrategy.LINKED) return true;
  if (strategy === CloneStrategy.FULL) return false;
  return storageType !== null && COW.has(storageType);
}
