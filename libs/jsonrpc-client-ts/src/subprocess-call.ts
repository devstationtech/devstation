import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Spawn, SpawnedProcess } from "@jsonrpc-client-ts/spawn.ts";
import type { Id } from "@jsonrpc-client-ts/envelope/id.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";

/**
 * Long-lived JSON-RPC connection to a devstation-server subprocess.
 *
 * Spawns the binary once at construction, keeps stdin/stdout pipes open for
 * the lifetime of the UI, and correlates responses by envelope id. This is
 * THE production transport for every UI (Ink, Go, Electron): one spawn,
 * many requests, single integration shape.
 *
 * Implements `Channel`: id-correlated requests resolve through `send`;
 * server-initiated frames with no `id` are routed to subscribers via
 * `onNotification`.
 *
 * The Go example in examples/go-client/main.go uses the same pattern with
 * os/exec — different language, same lifecycle.
 *
 * The subprocess itself comes from an injected `Spawn` (web-standard
 * streams), keeping this lib runtime-agnostic: Deno consumers can import
 * the opt-in `deno-spawn.ts`; the DevStation TUI injects its platform
 * facade's spawner.
 */
export class SubprocessCall implements Channel {
  private readonly child: SpawnedProcess;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private readonly pending = new Map<Id, (response: Response) => void>();
  private readonly notificationHandlers = new Set<(n: Notification) => void>();
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private stopped = false;
  // Serializes concurrent sends. Each frame (header + payload) is written
  // one-at-a-time through this chain, so parallel invokes (e.g. a
  // Promise.all of several RPC calls plus stats polling) cannot interleave
  // bytes on the shared stdin writer and corrupt the Content-Length framing.
  private writeChain: Promise<void> = Promise.resolve();

  constructor(command: string, args: readonly string[], spawn: Spawn) {
    this.child = spawn(command, args);
    this.writer = this.child.stdin.getWriter();
    this.readLoop().catch((err) => {
      if (!this.stopped) console.error("[devstation-server] read loop failed:", err);
    });
  }

  send(request: Request): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      this.pending.set(request.id, resolve);
      const payload = this.encoder.encode(JSON.stringify(request));
      const header = this.encoder.encode(`Content-Length: ${payload.byteLength}\r\n\r\n`);
      const frame = concat(header, payload);
      this.writeChain = this.writeChain.then(async () => {
        try {
          await this.writer.write(frame);
        } catch (err) {
          this.pending.delete(request.id);
          reject(err);
        }
      });
    });
  }

  onNotification(handler: (notification: Notification) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    try {
      this.writer.releaseLock();
      await this.child.stdin.close();
    } catch {
      // already closed
    }
    this.child.kill();
    await this.child.status;
  }

  private async readLoop(): Promise<void> {
    const reader = this.child.stdout.getReader();
    let buffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

    try {
      while (true) {
        const sep = indexOf(buffer, HEADER_TERMINATOR);
        if (sep === -1) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer = concat(buffer, value);
          continue;
        }

        const length = parseContentLength(this.decoder.decode(buffer.subarray(0, sep)));
        if (length === null) {
          buffer = buffer.subarray(sep + HEADER_TERMINATOR.length) as Uint8Array<ArrayBuffer>;
          continue;
        }

        const start = sep + HEADER_TERMINATOR.length;
        const end = start + length;
        while (buffer.byteLength < end) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer = concat(buffer, value);
        }

        const frame = JSON.parse(
          this.decoder.decode(buffer.subarray(start, end)),
        ) as Response | Notification;
        buffer = buffer.subarray(end) as Uint8Array<ArrayBuffer>;

        // Notifications have no `id`; responses always do.
        if (!("id" in frame) || frame.id === null || frame.id === undefined) {
          for (const handler of this.notificationHandlers) handler(frame as Notification);
          continue;
        }
        const resolver = this.pending.get(frame.id);
        if (resolver) {
          this.pending.delete(frame.id);
          resolver(frame);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

const HEADER_TERMINATOR = new TextEncoder().encode("\r\n\r\n");

const indexOf = (haystack: Uint8Array, needle: Uint8Array): number => {
  outer: for (let i = 0; i <= haystack.byteLength - needle.byteLength; i++) {
    for (let j = 0; j < needle.byteLength; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
};

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(a.byteLength + b.byteLength));
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
};

const parseContentLength = (header: string): number | null => {
  for (const line of header.split(/\r?\n/)) {
    const match = line.match(/^Content-Length:\s*(\d+)\s*$/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
};
