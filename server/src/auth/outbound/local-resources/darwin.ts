import type { Process } from "@server/shared/process/domain/ports/outbound/process.ts";
import type { LocalResourcesAdapter } from "@server/auth/application/queries/local-resources/adapter.ts";
import type { LocalResourcesRecord } from "@server/auth/application/queries/local-resources/types/local-resources-record.ts";

/**
 * macOS implementation. Shells out to `top -l 1 -n 0 -s 0` which
 * prints an instant snapshot of CPU + memory without sampling delay
 * (the `-l 1` says "one sample" and `-n 0` skips listing processes).
 *
 * Output format we depend on (stable across macOS 11+):
 *
 *   CPU usage: 12.50% user, 8.33% sys, 79.16% idle
 *   PhysMem: 24G used (3G wired), 8G unused.
 *
 * We compute:
 *   cpu%  = 100 - idle
 *   ram%  = used / (used + unused)
 *
 * Locale-aware tools like `top` may print localized decimal separators;
 * we strip non-digit/non-`.` characters per token, so a Portuguese host
 * showing "12,50" still parses to 12.5 — same approach as systeminformation.
 */
const DECIMAL_LIKE = /^(\d+(?:[.,]\d+)?)/;

function parseNumber(token: string): number | null {
  const match = token.match(DECIMAL_LIKE);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

export class DarwinLocalResourcesAdapter implements LocalResourcesAdapter {
  constructor(private readonly process: Process) {}

  async snapshot(): Promise<LocalResourcesRecord> {
    const stdout = await this.runTopOnce();
    if (stdout === null) return { cpuPercent: 0, ramPercent: 0 };
    return {
      cpuPercent: this.parseCpu(stdout),
      ramPercent: this.parseRam(stdout),
    };
  }

  private async runTopOnce(): Promise<string | null> {
    try {
      const stdoutChunks: string[] = [];
      for await (
        const event of this.process.run({
          command: "top",
          args: ["-l", "1", "-n", "0", "-s", "0"],
        })
      ) {
        if (event.type === "stdout") stdoutChunks.push(event.line);
      }
      return stdoutChunks.join("\n");
    } catch {
      return null;
    }
  }

  private parseCpu(text: string): number {
    // "CPU usage: 12.50% user, 8.33% sys, 79.16% idle"
    const line = text.split("\n").find((l) => l.startsWith("CPU usage:"));
    if (!line) return 0;
    const idleMatch = line.match(/([\d.,]+)%\s+idle/);
    if (!idleMatch) return 0;
    const idle = parseNumber(idleMatch[1]) ?? 0;
    return Math.max(0, Math.min(100, 100 - idle));
  }

  private parseRam(text: string): number {
    // "PhysMem: 24G used (3G wired), 8G unused."
    const line = text.split("\n").find((l) => l.startsWith("PhysMem:"));
    if (!line) return 0;
    const used = this.parseSize(line, /([\d.,]+[KMGT]?)\s+used/i);
    const unused = this.parseSize(line, /([\d.,]+[KMGT]?)\s+unused/i);
    if (used === 0 && unused === 0) return 0;
    return (used / (used + unused)) * 100;
  }

  private parseSize(text: string, pattern: RegExp): number {
    const match = text.match(pattern);
    if (!match) return 0;
    const token = match[1];
    const num = parseNumber(token);
    if (num === null) return 0;
    const suffix = token.slice(-1).toUpperCase();
    const multipliers: Record<string, number> = {
      K: 1024,
      M: 1024 ** 2,
      G: 1024 ** 3,
      T: 1024 ** 4,
    };
    return num * (multipliers[suffix] ?? 1);
  }
}
