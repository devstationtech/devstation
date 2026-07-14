import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { Emitter } from "@server/shared/executions/domain/ports/outbound/emitter.ts";
import { LogTimeBuffer } from "@server/shared/executions/outbound/streaming/log-time-buffer.ts";

/** Where coalesced events are forwarded (the Execution's broadcast). */
export type EventSink = (event: ExecutionEvent) => void;

/**
 * Default `Emitter`: high-volume `log` events are time-buffered
 * (a `LogTimeBuffer`, hidden here) into fewer, larger frames so the
 * single serialized write path is not starved. Every
 * other event — `step`, terminals, anything — is forwarded immediately;
 * buffered logs are always flushed *before* a non-log event and before
 * the runtime broadcasts the terminal, so order and the
 * "terminal is last" invariant hold. Fairness is consolidated here, in
 * the executions BC; adapters stay clean.
 */
export class BufferedEmitter implements Emitter {
  private readonly logs: LogTimeBuffer;

  constructor(
    private readonly sink: EventSink,
    latency: number,
    lines: number,
  ) {
    this.logs = new LogTimeBuffer(latency, lines);
  }

  emit(event: ExecutionEvent): void {
    if (event.type === "log") {
      const chunk = this.logs.add((event as Log).line);
      if (chunk !== null) this.sink(new Log(chunk));
      return;
    }
    this.flush(); // never let a non-log event overtake buffered logs
    this.sink(event);
  }

  /** Drain buffered logs — the runtime calls this before the terminal. */
  flush(): void {
    const chunk = this.logs.drain();
    if (chunk !== null) this.sink(new Log(chunk));
  }
}
