import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type {
  Process,
  ProcessEvent,
  ProcessRequest,
} from "@server/shared/process/domain/ports/outbound/process.ts";
import { WindowsLocalResourcesAdapter } from "@server/auth/outbound/local-resources/windows.ts";

/**
 * The Windows adapter shells out once to `powershell -Command` with
 * a small script that emits `{"cpu": <num>, "ram": <num>}`. Tests
 * pin the parsing contract; the actual Get-Counter / Win32_OS calls
 * live in the script string and can only be smoke-tested on Windows.
 */

class StubProcess implements Process {
  readonly calls: ProcessRequest[] = [];
  constructor(
    private readonly stdout: string,
    private readonly fails = false,
    private readonly stderr = "",
    private readonly exitCode = 0,
  ) {}
  async *run(request: ProcessRequest): AsyncIterable<ProcessEvent> {
    this.calls.push(request);
    if (this.fails) throw new Error("command not found: powershell");
    for (const line of this.stdout.split("\n")) yield { type: "stdout", line };
    if (this.stderr) {
      for (const line of this.stderr.split("\n")) yield { type: "stderr", line };
    }
    yield { type: "exit", code: this.exitCode };
  }
}

describe("WindowsLocalResourcesAdapter — parses powershell JSON", () => {
  it("invokes `powershell -NoProfile -Command <script>`", async () => {
    /* @Given a stub powershell returning compact JSON */
    const proc = new StubProcess(`{"cpu":12.5,"ram":40.0}`);
    const sut = new WindowsLocalResourcesAdapter(proc);

    /* @When snapshot runs */
    await sut.snapshot();

    /* @Then it spawns powershell with the expected flags + WMI-based script */
    assertEquals(proc.calls.length, 1);
    assertEquals(proc.calls[0].command, "powershell");
    assertEquals(proc.calls[0].args[0], "-NoProfile");
    assertEquals(proc.calls[0].args[1], "-Command");
    // Script must mention the two data sources we depend on; if these
    // disappear during a script edit, the parser would silently fall
    // back to 0/0 and the UI would look broken without an error.
    const script = proc.calls[0].args[2];
    // The script must use the WMI class (locale-independent),
    // not Get-Counter (localized counter set names break on
    // non-English Windows installs).
    assertEquals(script.includes("Win32_PerfFormattedData_PerfOS_Processor"), true);
    assertEquals(script.includes("Win32_OperatingSystem"), true);
    assertEquals(
      script.includes("Get-Counter"),
      false,
      "Get-Counter relies on locale-translated paths and must not appear",
    );
  });

  it("parses the compact JSON output into cpu + ram percentages", async () => {
    /* @Given valid compact JSON output */
    const proc = new StubProcess(`{"cpu":12.5,"ram":40.0}`);
    /* @When snapshot parses it */
    const out = await new WindowsLocalResourcesAdapter(proc).snapshot();
    /* @Then cpu + ram percentages are returned */
    assertEquals(out, { cpuPercent: 12.5, ramPercent: 40 });
  });

  it("clamps values into [0,100] (defensive against bad scripts)", async () => {
    /* @Given out-of-range values */
    const proc = new StubProcess(`{"cpu":150,"ram":-5}`);
    /* @When snapshot parses it */
    const out = await new WindowsLocalResourcesAdapter(proc).snapshot();
    /* @Then values are clamped into [0,100] */
    assertEquals(out, { cpuPercent: 100, ramPercent: 0 });
  });

  it("returns 0/0 when output is not JSON (script failed)", async () => {
    /* @Given non-JSON output */
    const proc = new StubProcess(`some error message\nthat isn't JSON`);
    /* @When snapshot runs */
    const out = await new WindowsLocalResourcesAdapter(proc).snapshot();
    /* @Then it degrades to 0/0 */
    assertEquals(out, { cpuPercent: 0, ramPercent: 0 });
  });

  it("returns 0/0 when powershell is missing or the spawn fails", async () => {
    /* @Given a process that fails to spawn powershell */
    const proc = new StubProcess("", true);
    /* @When snapshot runs */
    const out = await new WindowsLocalResourcesAdapter(proc).snapshot();
    /* @Then it degrades to 0/0 */
    assertEquals(out, { cpuPercent: 0, ramPercent: 0 });
  });

  it("still returns 0/0 (degraded) when the script errors with localized message — and writes warn line", async () => {
    /* @Given powershell exits non-zero with a localized stderr error, no JSON */
    // Reproduces the pt-BR Get-Counter failure shape: PowerShell exits
    // non-zero, prints a localized error on stderr, no JSON on stdout.
    // UI must keep working (degraded), and the engine must surface the
    // failure on stderr so a future regression isn't invisible.
    const proc = new StubProcess(
      "",
      false,
      "ERROR:O objeto especificado não foi encontrado no computador.",
      1,
    );

    const captured: string[] = [];
    const ogWriteSync = Deno.stderr.writeSync;
    Deno.stderr.writeSync = (data: Uint8Array): number => {
      captured.push(new TextDecoder().decode(data));
      return data.length;
    };
    /* @When snapshot runs with stderr captured */
    try {
      const out = await new WindowsLocalResourcesAdapter(proc).snapshot();
      assertEquals(out, { cpuPercent: 0, ramPercent: 0 });
    } finally {
      Deno.stderr.writeSync = ogWriteSync;
    }
    /* @Then it degrades to 0/0 and surfaces a warn line carrying exit + message */
    assertEquals(captured.length, 1);
    assertEquals(captured[0].includes("local-resources(win)"), true);
    assertEquals(captured[0].includes("exit=1"), true);
    assertEquals(captured[0].includes("não foi encontrado"), true);
  });
});
