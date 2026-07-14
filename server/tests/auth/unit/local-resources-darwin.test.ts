import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type {
  Process,
  ProcessEvent,
  ProcessRequest,
} from "@server/shared/process/domain/ports/outbound/process.ts";
import { DarwinLocalResourcesAdapter } from "@server/auth/outbound/local-resources/darwin.ts";

/**
 * The Darwin adapter shells out to `top -l 1 -n 0 -s 0` and parses
 * the human-formatted output. These tests pin the parser against
 * realistic samples (incl. localized formatting and degenerate
 * cases) so output drift in macOS surfaces here, not at runtime.
 */

class StubProcess implements Process {
  readonly calls: ProcessRequest[] = [];
  constructor(private readonly stdout: string, private readonly fails = false) {}
  async *run(request: ProcessRequest): AsyncIterable<ProcessEvent> {
    this.calls.push(request);
    if (this.fails) throw new Error("command not found: top");
    for (const line of this.stdout.split("\n")) yield { type: "stdout", line };
    yield { type: "exit", code: 0 };
  }
}

const REAL_TOP_OUTPUT = `Processes: 419 total, 2 running, 417 sleeping, 2123 threads
2026/05/24 18:32:42
Load Avg: 1.85, 1.62, 1.45
CPU usage: 12.50% user, 8.33% sys, 79.16% idle
SharedLibs: 410M resident, 90M data, 24M linkedit.
MemRegions: 178902 total, 4321M resident, 256M private, 2453M shared.
PhysMem: 24G used (3G wired, 567M compressor), 8G unused.
VM: 234T vsize, 5512M framework vsize, 0(0) swapins, 0(0) swapouts.
Networks: packets: 12345/8765K in, 5432/3210K out.
Disks: 1234/56G read, 789/40G written.
`;

describe("DarwinLocalResourcesAdapter — parses `top -l 1 -n 0`", () => {
  it("invokes `top` with the expected one-sample flags", async () => {
    /* @Given a stub process returning real `top` output */
    const proc = new StubProcess(REAL_TOP_OUTPUT);
    const sut = new DarwinLocalResourcesAdapter(proc);

    /* @When snapshot runs */
    await sut.snapshot();

    /* @Then it spawns `top` once with the one-sample flags */
    assertEquals(proc.calls.length, 1);
    assertEquals(proc.calls[0].command, "top");
    assertEquals(proc.calls[0].args, ["-l", "1", "-n", "0", "-s", "0"]);
  });

  it("extracts CPU% as 100 - idle from the `CPU usage:` line", async () => {
    /* @Given real `top` output with 79.16% idle */
    const proc = new StubProcess(REAL_TOP_OUTPUT);
    /* @When snapshot parses it */
    const out = await new DarwinLocalResourcesAdapter(proc).snapshot();
    /* @Then CPU% is 100 - idle */
    // idle = 79.16; cpu% = 100 - 79.16 = 20.84
    assertEquals(out.cpuPercent.toFixed(2), "20.84");
  });

  it("extracts RAM% as used / (used + unused) from `PhysMem:` line", async () => {
    /* @Given real `top` output with 24G used / 8G unused */
    const proc = new StubProcess(REAL_TOP_OUTPUT);
    /* @When snapshot parses it */
    const out = await new DarwinLocalResourcesAdapter(proc).snapshot();
    /* @Then RAM% is used / (used + unused) */
    // 24G used + 8G unused → 24 / 32 = 75
    assertEquals(out.ramPercent, 75);
  });

  it("handles localized decimal separator (pt-BR / es-ES `top`)", async () => {
    /* @Given `top` output using a comma decimal separator */
    const localized = REAL_TOP_OUTPUT.replace("79.16% idle", "79,16% idle");
    const proc = new StubProcess(localized);
    /* @When snapshot parses it */
    const out = await new DarwinLocalResourcesAdapter(proc).snapshot();
    /* @Then CPU% is still parsed correctly */
    assertEquals(out.cpuPercent.toFixed(2), "20.84");
  });

  it("returns 0/0 when `top` is missing or fails", async () => {
    /* @Given a process that fails to spawn `top` */
    const proc = new StubProcess("", true);
    /* @When snapshot runs */
    const out = await new DarwinLocalResourcesAdapter(proc).snapshot();
    /* @Then it degrades to 0/0 */
    assertEquals(out, { cpuPercent: 0, ramPercent: 0 });
  });

  it("returns 0 for fields it cannot parse (defensive)", async () => {
    /* @Given unparseable garbage output */
    const garbage = "this is not what top would print";
    const proc = new StubProcess(garbage);
    /* @When snapshot runs */
    const out = await new DarwinLocalResourcesAdapter(proc).snapshot();
    /* @Then it defensively returns 0/0 */
    assertEquals(out, { cpuPercent: 0, ramPercent: 0 });
  });
});
