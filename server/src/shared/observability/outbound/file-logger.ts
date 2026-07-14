import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

export class FileLogger implements Logger {
  constructor(private readonly fs: FileSystem) {}

  async info(origin: string, message: string): Promise<void> {
    await this.append("INFO", origin, message);
  }

  async warn(origin: string, message: string): Promise<void> {
    await this.append("WARN", origin, message);
  }

  async error(origin: string, message: string, cause?: unknown): Promise<void> {
    const detail = cause instanceof Error
      ? cause.message
      : cause != null
      ? String(cause)
      : undefined;
    await this.append("ERROR", origin, detail ? `${message}: ${detail}` : message);
  }

  private async append(level: string, origin: string, message: string): Promise<void> {
    try {
      const line = this.format(level, origin, message);
      await this.fs.append(this.filename(new Date()), line);
    } catch (error) {
      await Deno.stderr.write(new TextEncoder().encode(`[logger] failed to write log: ${error}\n`));
    }
  }

  private filename(at: Date): string {
    const y = at.getUTCFullYear();
    const m = String(at.getUTCMonth() + 1).padStart(2, "0");
    const d = String(at.getUTCDate()).padStart(2, "0");
    const h = String(at.getUTCHours()).padStart(2, "0");
    return `${y}-${m}-${d}-${h}.log`;
  }

  private format(level: string, origin: string, message: string): string {
    const ts = new Date().toISOString();
    const lvl = `[${level}]`.padEnd(7);
    return `${ts} ${lvl} ${origin.padEnd(32)} ${message}\n`;
  }
}
