import type { Process } from "@server/shared/process/domain/ports/outbound/process.ts";
import type { LocalResourcesAdapter } from "@server/auth/application/queries/local-resources/adapter.ts";
import type { LocalResourcesRecord } from "@server/auth/application/queries/local-resources/types/local-resources-record.ts";

/**
 * Windows implementation. Shells out once to `powershell -Command`
 * with a tiny script that emits JSON with both CPU% and RAM%.
 *
 * CPU uses `Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor`,
 * **not** `Get-Counter '\Processor(_Total)\% Processor Time'`.
 * The first version shipped with the Get-Counter path string in
 * English and silently broke on every non-English Windows install:
 * the counter set is **localized** by the OS (pt-BR uses
 * `\Processador(_Total)\% tempo de processador`, German has its own
 * names, …) and `Get-Counter` raises a localized error, which our
 * `$ErrorActionPreference='Stop'` swallowed before reaching the JSON
 * emit — UI showed CPU 0% / RAM 0% forever on non-English Windows installs.
 *
 * `Win32_PerfFormattedData_PerfOS_Processor` is a WMI class:
 * property names are part of the .NET API and never localized, so
 * the same script runs on en-US / pt-BR / ja-JP without changes.
 *
 * RAM uses `Get-CimInstance Win32_OperatingSystem`
 * (`FreePhysicalMemory` + `TotalVisibleMemorySize`, both in KB) —
 * also locale-independent and already worked.
 *
 * `ConvertTo-Json -Compress` emits a single line we parse strictly.
 *
 * Defensive logging: when the script fails
 * or stderr is non-empty, we write the first line of stderr to the
 * engine's own stderr so a future regression has a visible trail
 * instead of silent 0/0.
 */
const POWERSHELL_SCRIPT = `
$ErrorActionPreference = 'Stop'
$cpuRaw = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'"
$cpu = [double]$cpuRaw.PercentProcessorTime
$mem = Get-CimInstance Win32_OperatingSystem
$ram = (1 - ($mem.FreePhysicalMemory / $mem.TotalVisibleMemorySize)) * 100
[PSCustomObject]@{ cpu = [math]::Round($cpu, 2); ram = [math]::Round($ram, 2) } | ConvertTo-Json -Compress
`;

export class WindowsLocalResourcesAdapter implements LocalResourcesAdapter {
  constructor(private readonly process: Process) {}

  async snapshot(): Promise<LocalResourcesRecord> {
    try {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let exitCode = 0;
      for await (
        const event of this.process.run({
          command: "powershell",
          args: ["-NoProfile", "-Command", POWERSHELL_SCRIPT],
        })
      ) {
        if (event.type === "stdout") stdoutChunks.push(event.line);
        else if (event.type === "stderr") stderrChunks.push(event.line);
        else if (event.type === "exit") exitCode = event.code;
      }
      const out = stdoutChunks.join("\n").trim();
      if (!out.startsWith("{")) {
        warnPowershellFailure(exitCode, stderrChunks);
        return { cpuPercent: 0, ramPercent: 0 };
      }
      const parsed = JSON.parse(out) as { cpu?: number; ram?: number };
      return {
        cpuPercent: clamp(parsed.cpu ?? 0),
        ramPercent: clamp(parsed.ram ?? 0),
      };
    } catch {
      return { cpuPercent: 0, ramPercent: 0 };
    }
  }
}

/**
 * Emit a single warn line so a broken PowerShell adapter is visible
 * in MCP transcripts and dev logs. Bounded to ~400 chars to stay
 * inside reasonable log line widths.
 */
function warnPowershellFailure(exitCode: number, stderrChunks: string[]): void {
  const first = stderrChunks
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(" | ")
    .slice(0, 400);
  if (exitCode === 0 && first === "") return;
  try {
    Deno.stderr.writeSync(
      new TextEncoder().encode(
        `local-resources(win): powershell exit=${exitCode}` +
          (first ? ` stderr="${first}"` : "") + "\n",
      ),
    );
  } catch {
    // never let logging take down the snapshot path
  }
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
