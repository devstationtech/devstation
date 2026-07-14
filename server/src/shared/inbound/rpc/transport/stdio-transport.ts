import type { Request } from "@server/shared/inbound/rpc/envelope/request.ts";
import type { Response } from "@server/shared/inbound/rpc/envelope/response/response.ts";
import type { Notification } from "@server/shared/inbound/rpc/envelope/notification.ts";
import type { Transport } from "@server/shared/inbound/rpc/transport/transport.ts";

/**
 * LSP-style stdio transport.
 *
 *   Content-Length: <N>\r\n
 *   \r\n
 *   <N bytes of UTF-8 JSON>
 *
 * Robust to payloads containing newlines (unlike NDJSON). When the project
 * adopts a battle-tested implementation (e.g. `vscode-jsonrpc`), only this
 * class is replaced — the Transport interface stays.
 */
export class StdioTransport implements Transport {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  // Serializes concurrent sends. The server handles requests concurrently,
  // so responses race: acquiring a fresh writer per call would throw (the
  // stream is already locked) and two separate writes would interleave on
  // the wire, corrupting the Content-Length framing. One writer, one chain,
  // one atomic frame per message.
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly source: ReadableStream<Uint8Array>,
    private readonly sink: WritableStream<Uint8Array>,
  ) {}

  get incoming(): AsyncIterable<Request> {
    return this.read();
  }

  send(message: Response | Notification<string, unknown>): Promise<void> {
    const payload = this.encoder.encode(JSON.stringify(message));
    const header = this.encoder.encode(`Content-Length: ${payload.byteLength}\r\n\r\n`);
    const frame = concat(header, payload);

    const done = this.writeChain.then(() => {
      this.writer ??= this.sink.getWriter();
      return this.writer.write(frame);
    });
    this.writeChain = done.catch(() => {});
    return done;
  }

  private async *read(): AsyncGenerator<Request> {
    const reader = this.source.getReader();
    let buffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

    try {
      while (true) {
        const headerEnd = indexOf(buffer, HEADER_TERMINATOR);
        if (headerEnd === -1) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer = concat(buffer, value);
          continue;
        }

        const headerText = this.decoder.decode(buffer.subarray(0, headerEnd));
        const length = parseContentLength(headerText);
        if (length === null) {
          buffer = buffer.subarray(headerEnd + HEADER_TERMINATOR.length) as Uint8Array<ArrayBuffer>;
          continue;
        }

        const payloadStart = headerEnd + HEADER_TERMINATOR.length;
        const payloadEnd = payloadStart + length;

        while (buffer.byteLength < payloadEnd) {
          const { value, done } = await reader.read();
          if (done) return;
          buffer = concat(buffer, value);
        }

        const payload = this.decoder.decode(buffer.subarray(payloadStart, payloadEnd));
        buffer = buffer.subarray(payloadEnd) as Uint8Array<ArrayBuffer>;

        yield JSON.parse(payload) as Request;
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
