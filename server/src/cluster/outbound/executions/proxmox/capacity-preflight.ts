import type { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import type { Node } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import type { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";

const GIB = 1024 * 1024 * 1024;
const SPARSE_RATIO = 0.8;

/**
 * Best-effort, non-blocking capacity check before a provisioning run.
 * Sums each VM's disk size per target datastore and compares to live
 * free space from the Proxmox API. Emits actionable **warnings** (never
 * blocks — `disk_size` is an estimate; thin/linked grows later).
 * Any failure → no warnings (degrades silently).
 */
export class CapacityPreflight {
  constructor(private readonly apiFactory: ProxmoxReadApiFactory) {}

  async warnings(
    connection: Connection,
    node: Node,
    virtualMachines: readonly VirtualMachine[],
  ): Promise<string[]> {
    try {
      const api = await this.apiFactory.create({
        host: connection.host.value,
        vaultId: connection.vault.value,
        secretId: connection.secret.value,
      });
      if (!api) return [];
      const storages = await api.storages(node.name.value);
      const byId = new Map(storages.map((s) => [s.id, s]));

      const requiredGiBByStorage = new Map<string, number>();
      for (const vm of virtualMachines) {
        const id = vm.storage.value;
        requiredGiBByStorage.set(
          id,
          (requiredGiBByStorage.get(id) ?? 0) + vm.resources.disk.value,
        );
      }

      const out: string[] = [];
      for (const [id, requiredGiB] of requiredGiBByStorage) {
        const s = byId.get(id);
        if (!s) continue; // unknown datastore — nothing to compare
        const requiredBytes = requiredGiB * GIB;
        const availGiB = Math.round(s.available / GIB);
        if (requiredBytes > s.available) {
          out.push(
            `⚠ ${node.name.value}/${id}: needs ~${requiredGiB}GiB but only ` +
              `~${availGiB}GiB free — provisioning may fail (estimate; proceeding)`,
          );
        } else if (
          s.type === "zfspool" && requiredBytes > s.available * SPARSE_RATIO
        ) {
          out.push(
            `⚠ ${node.name.value}/${id} (zfspool): ~${requiredGiB}GiB of ` +
              `~${availGiB}GiB free — if the pool is not sparse the zvol ` +
              `reserves full size and may exhaust space (heuristic)`,
          );
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}
