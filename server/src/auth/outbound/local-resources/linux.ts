import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { LocalResourcesAdapter } from "@server/auth/application/queries/local-resources/adapter.ts";
import type { LocalResourcesRecord } from "@server/auth/application/queries/local-resources/types/local-resources-record.ts";

/**
 * Linux implementation: parses `/proc/stat` for cumulative CPU ticks
 * (delta-based against the previous snapshot for instantaneous %) and
 * `/proc/meminfo` for instant RAM usage.
 *
 * CPU% is delta-based: cumulative ticks are meaningless on their own;
 * we keep the previous sample and compute (busyDelta / totalDelta).
 * First call seeds and returns 0%. Subsequent calls return a real
 * value. The adapter must be a singleton (registered once in DI)
 * because of this state.
 */
export class LinuxLocalResourcesAdapter implements LocalResourcesAdapter {
  private prevCpu: { idle: number; total: number } | null = null;

  constructor(private readonly fs: FileSystem) {}

  async snapshot(): Promise<LocalResourcesRecord> {
    const [cpuPercent, ramPercent] = await Promise.all([
      this.readCpu(),
      this.readRam(),
    ]);
    return { cpuPercent, ramPercent };
  }

  private async readCpu(): Promise<number> {
    try {
      const text = await this.fs.read("/proc/stat");
      const line = text.split("\n").find((l) => l.startsWith("cpu "));
      if (!line) return 0;
      const fields = line.split(/\s+/).slice(1).map(Number);
      const idle = (fields[3] ?? 0) + (fields[4] ?? 0); // idle + iowait
      const total = fields.reduce((s, v) => s + v, 0);
      if (!this.prevCpu) {
        this.prevCpu = { idle, total };
        return 0;
      }
      const idleDelta = idle - this.prevCpu.idle;
      const totalDelta = total - this.prevCpu.total;
      this.prevCpu = { idle, total };
      if (totalDelta <= 0) return 0;
      return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
    } catch {
      return 0;
    }
  }

  private async readRam(): Promise<number> {
    try {
      const text = await this.fs.read("/proc/meminfo");
      const lines = text.split("\n");
      const get = (key: string): number => {
        const line = lines.find((l) => l.startsWith(`${key}:`));
        if (!line) return 0;
        return Number(line.split(/\s+/)[1]) || 0;
      };
      const total = get("MemTotal");
      const available = get("MemAvailable");
      if (total === 0) return 0;
      return ((total - available) / total) * 100;
    } catch {
      return 0;
    }
  }
}
