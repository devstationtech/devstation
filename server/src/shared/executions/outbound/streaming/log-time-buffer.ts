/**
 * Time-windowed buffer for a high-volume log-line stream (fairness).
 *
 * Provisioning/SSH emit one event per stdout line; each becomes one
 * `execution.event` notification = one frame on the single serialized
 * write path. Under a long run that firehose starves request responses
 * (the UI hangs on "Loading…"). Buffering consecutive lines into
 * fewer, larger chunks (joined with "\n", order preserved) fixes it —
 * the same message-layer debounce mature language servers use for
 * diagnostics; the transport stays a dumb FIFO.
 *
 * No timers: a chunk is emitted when it reaches `lines` (the cap) or
 * when the latency window has elapsed (observed as the next line
 * arrives); any boundary (non-log event, stream end, source error)
 * drains it explicitly. During a quiet gap there is no firehose to
 * tame, so "flush on pure silence" is deliberately not done — it was
 * the only thing that needed a timer.
 */
export class LogTimeBuffer {
  private readonly buffered: string[] = [];
  private windowStart = 0;

  constructor(
    /** Max time, in milliseconds, a line may wait before being flushed. */
    private readonly latency: number,
    /** Max lines to accumulate before flushing regardless of latency. */
    private readonly lines: number,
  ) {}

  /** Buffer a line; returns a chunk to emit now, or null to keep buffering. */
  add(line: string): string | null {
    if (this.buffered.length === 0) this.windowStart = Date.now();
    this.buffered.push(line);
    const full = this.buffered.length >= this.lines;
    const elapsed = Date.now() - this.windowStart >= this.latency;
    return full || elapsed ? this.drain() : null;
  }

  /** Emit whatever is buffered (or null if empty). */
  drain(): string | null {
    if (this.buffered.length === 0) return null;
    const chunk = this.buffered.join("\n");
    this.buffered.length = 0;
    return chunk;
  }
}

// ~75ms latency / ≤40 lines: collapses the provisioning runner's per-line firehose to
// at most ~13 frames/s while the log still feels live (the UI itself
// already buffers at 100ms). Terminals/Steps are separate events and
// are never delayed by this.
export const LOG_LATENCY_MS = 75;
export const LOG_LINES = 40;
