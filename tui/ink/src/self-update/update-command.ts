/**
 * Headless `devstation update --check`: forces a fresh check against the
 * release manifest, bypassing the 24h cache window — the escape hatch for
 * "a release just shipped and the cached latestVersion still hides it".
 * The forced fetch also refreshes the cache, so the TUI banner reflects
 * the new release immediately after.
 *
 * Check-only by design: installing still goes through the TUI update
 * screen, which owns the download/stage/swap flow.
 */
import { VERSION } from "@ui/cli/version.ts";
import { checkForUpdate } from "@ui/self-update/update-check.ts";

type Check = typeof checkForUpdate;
type Print = (line: string) => void;

/** Runs the forced check and reports; returns the process exit code. */
export async function runUpdateCheck(
  check: Check = checkForUpdate,
  print: Print = console.log,
): Promise<number> {
  const status = await check({ force: true });
  switch (status.kind) {
    case "available":
      print(`update available: ${VERSION} -> ${status.latest}`);
      print("run `devstation` and open the update screen to install.");
      return 0;
    case "current":
      print(`devstation ${VERSION} is up to date.`);
      return 0;
    case "skipped":
      print(`update check unavailable: ${status.reason}.`);
      return 1;
    default:
      print("could not reach the update server.");
      return 1;
  }
}
