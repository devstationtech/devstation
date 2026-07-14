import chalk from "chalk";
import { dimText } from "@ui/shared/theme/colorize.ts";

export type StatusTone = "ok" | "warn" | "danger" | "muted";

/**
 * Render a status dot (●), coloured by tone. The `muted` variant goes
 * through `dimText` so it stays legible on light terminal backgrounds
 * — `chalk.gray` collapses into near-invisible faint grey on white.
 */
export function statusDot(tone: StatusTone): string {
  switch (tone) {
    case "ok":
      return chalk.green("●");
    case "warn":
      return chalk.yellow("●");
    case "danger":
      return chalk.red("●");
    case "muted":
      return dimText("●");
  }
}
