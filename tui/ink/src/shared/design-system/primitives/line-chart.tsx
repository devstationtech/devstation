/// <reference types="@types/react" />
import { Box, Text } from "ink";
import asciichart from "asciichart";
import { DimText } from "@ui/shared/theme/mod.ts";

type Series = {
  data: number[];
  color?: string; // asciichart color name (red, green, blue, yellow, cyan, magenta...)
  label?: string;
};

type Props = {
  title?: string;
  series: Series[];
  height?: number;
  maxWidth?: number;
  formatValue?: (n: number) => string;
  // Optional X-axis tick labels distributed evenly across the plot area
  // (after the y-axis labels). First label sits at the left edge, last at
  // the right edge, others spaced equally. Pass nothing to skip the axis.
  xTicks?: string[];
};

// Columns asciichart reserves before the plot area. Layout per row is:
//   <10-char y-label><space><tick-char><plot-chars>
// Total = 12. Used to size the downsample target and to align the X-axis
// ticks with the plot area.
const Y_AXIS_PADDING = 12;

function downsample(data: number[], target: number): number[] {
  if (target <= 0 || data.length <= target) return data;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor((i * data.length) / target);
    const end = Math.max(Math.floor(((i + 1) * data.length) / target), start + 1);
    const slice = data.slice(start, end);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

const COLOR_MAP: Record<string, string> = {
  red: asciichart.red,
  green: asciichart.green,
  yellow: asciichart.yellow,
  blue: asciichart.blue,
  magenta: asciichart.magenta,
  cyan: asciichart.cyan,
  white: asciichart.white,
  lightred: asciichart.lightred,
  lightgreen: asciichart.lightgreen,
  lightyellow: asciichart.lightyellow,
  lightblue: asciichart.lightblue,
  lightcyan: asciichart.lightcyan,
};

function buildXAxisLine(ticks: string[], plotWidth: number): string {
  if (ticks.length === 0 || plotWidth <= 0) return "";
  if (ticks.length === 1) return ticks[0];
  const slots = new Array(plotWidth).fill(" ");
  ticks.forEach((tick, i) => {
    const ratio = i / (ticks.length - 1);
    let start = Math.round(ratio * (plotWidth - tick.length));
    // Clamp into bounds.
    start = Math.max(0, Math.min(plotWidth - tick.length, start));
    for (let j = 0; j < tick.length; j++) {
      if (start + j < slots.length) slots[start + j] = tick[j];
    }
  });
  return slots.join("");
}

export function LineChart({ title, series, height = 6, maxWidth, formatValue, xTicks }: Props) {
  if (series.length === 0 || series.every((s) => s.data.length === 0)) {
    return (
      <Box flexDirection="column">
        {title && <Text bold>{title}</Text>}
        <DimText>(no data)</DimText>
      </Box>
    );
  }

  const padding = "          ";
  const targetCols = maxWidth ? Math.max(8, maxWidth - Y_AXIS_PADDING) : 0;
  const sampled = targetCols > 0
    ? series.map((s) => ({ ...s, data: downsample(s.data, targetCols) }))
    : series;
  const data = sampled.length === 1 ? sampled[0].data : sampled.map((s) => s.data);
  const colors = sampled.map((s) => COLOR_MAP[s.color ?? "cyan"] ?? asciichart.cyan);
  const cfg: Record<string, unknown> = {
    height,
    colors,
    format: formatValue
      ? (x: number) => (padding + formatValue(x)).slice(-padding.length)
      : (x: number) => (padding + x.toFixed(2)).slice(-padding.length),
  };
  const chart = asciichart.plot(data as number[] | number[][], cfg);

  // Plot width (number of plot columns) — what's left of the chart line after
  // the y-axis prefix. Used to distribute the xTicks across the plot area so
  // they line up with the chart points.
  const firstLine = chart.split("\n")[0] ?? "";
  // Strip ANSI color escapes from asciichart output before measuring.
  // deno-lint-ignore no-control-regex
  const visible = firstLine.replace(/\x1b\[[0-9;]*m/g, "");
  const plotWidth = Math.max(0, visible.length - Y_AXIS_PADDING);
  const xAxisLine = xTicks && xTicks.length > 0 ? buildXAxisLine(xTicks, plotWidth) : null;

  return (
    <Box flexDirection="column">
      {title && (
        <Box gap={2}>
          <Text bold>{title}</Text>
          {sampled.length > 1 && (
            <Box gap={2}>
              {sampled.map((s, i) => (
                <Text key={i} color={s.color}>● {s.label ?? `series ${i + 1}`}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}
      <Text>
        {xAxisLine !== null ? `${chart}\n${" ".repeat(Y_AXIS_PADDING)}${xAxisLine}` : chart}
      </Text>
    </Box>
  );
}
