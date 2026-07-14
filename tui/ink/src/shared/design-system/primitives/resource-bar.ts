import chalk from "chalk";

const DEFAULT_WIDTH = 22;

export type BarOptions = {
  width?: number;
};

export function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0;
}

export function formatGiB(value: number): string {
  return value.toFixed(2).padStart(6);
}

export function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function labeledBar(percent: number, label: string, options: BarOptions = {}): string {
  const width = options.width ?? DEFAULT_WIDTH;
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const padL = Math.max(0, Math.floor((width - label.length) / 2));
  const padR = Math.max(0, width - label.length - padL);
  const full = " ".repeat(padL) + label + " ".repeat(padR);
  const bg = clamped >= 90 ? chalk.bgRed : clamped >= 70 ? chalk.bgYellow : chalk.bgGreen;
  return bg.black(full.slice(0, filled)) + chalk.bgGray.white(full.slice(filled));
}

export function emptyBar(label: string, options: BarOptions = {}): string {
  const width = options.width ?? DEFAULT_WIDTH;
  const padL = Math.max(0, Math.floor((width - label.length) / 2));
  const padR = Math.max(0, width - label.length - padL);
  return chalk.bgGray.white(" ".repeat(padL) + label + " ".repeat(padR));
}
