import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { FileLogger } from "@server/shared/observability/outbound/file-logger.ts";

/**
 * FileLogger writes one log file per UTC hour into ~/.devstation/logs/.
 * Pin the format (timestamp + level + origin + message) and the
 * append-only behavior so format drift breaks here, not in
 * downstream log parsers.
 */
async function withLogger<T>(
  fn: (logger: FileLogger, fs: FileSystem, dir: string) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "logger-test-" });
  try {
    const fs = new FileSystem(dir);
    return await fn(new FileLogger(fs), fs, dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

function currentLogFile(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d}-${h}.log`;
}

describe("FileLogger.info / warn / error", () => {
  it("writes one line per call with the level + origin + message", async () => {
    await withLogger(async (logger, fs) => {
      /* @Given a fresh logger */
      /* @When three calls (info, warn, error) are made */
      await logger.info("test-origin", "first");
      await logger.warn("test-origin", "second");
      await logger.error("test-origin", "third");
      /* @Then the current-hour file has three lines, one per call */
      const content = await fs.read(currentLogFile());
      const lines = content.split("\n").filter((l) => l.length > 0);
      assertEquals(lines.length, 3);
      assertStringIncludes(lines[0], "[INFO]");
      assertStringIncludes(lines[1], "[WARN]");
      assertStringIncludes(lines[2], "[ERROR]");
      for (const line of lines) {
        assertStringIncludes(line, "test-origin");
      }
    });
  });

  it("error appends the cause message when a cause Error is provided", async () => {
    await withLogger(async (logger, fs) => {
      /* @Given an Error as cause */
      const cause = new Error("connection refused");
      /* @When error is called with that cause */
      await logger.error("rpc.x", "failed", cause);
      /* @Then the line contains both the message and the cause */
      const content = await fs.read(currentLogFile());
      assertStringIncludes(content, "failed: connection refused");
    });
  });

  it("error stringifies a non-Error cause", async () => {
    /* @Given a non-Error cause (a string) */
    await withLogger(async (logger, fs) => {
      await logger.error("rpc.x", "boom", "raw-string-cause");
      const content = await fs.read(currentLogFile());
      assertStringIncludes(content, "boom: raw-string-cause");
    });
  });

  it("error omits the colon when no cause is provided", async () => {
    await withLogger(async (logger, fs) => {
      await logger.error("rpc.x", "just a message");
      const line = (await fs.read(currentLogFile())).trim();
      assertEquals(line.endsWith("just a message"), true);
      // no trailing ":" before the message
      assertEquals(line.includes("just a message:"), false);
    });
  });

  it("each line starts with an ISO-8601 timestamp", async () => {
    await withLogger(async (logger, fs) => {
      await logger.info("x", "y");
      const line = await fs.read(currentLogFile());
      // 2026-05-20T01:23:45.678Z
      assertEquals(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /.test(line), true);
    });
  });

  it("appends to the same hourly file across calls (never truncates)", async () => {
    await withLogger(async (logger, fs) => {
      await logger.info("x", "first");
      await logger.info("x", "second");
      const lines = (await fs.read(currentLogFile())).split("\n").filter(Boolean);
      assertEquals(lines.length, 2);
    });
  });
});
