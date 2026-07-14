import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { StdioTransport } from "@server/shared/inbound/rpc/transport/stdio-transport.ts";
import type { Request } from "@server/shared/inbound/rpc/envelope/request.ts";
import type { Response } from "@server/shared/inbound/rpc/envelope/response/response.ts";

const frame = (json: string): Uint8Array =>
  new TextEncoder().encode(
    `Content-Length: ${new TextEncoder().encode(json).byteLength}\r\n\r\n${json}`,
  );

const concat = (...chunks: Uint8Array[]): Uint8Array => {
  const len = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
};

const source = (data: Uint8Array, chunkSize: number): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < data.byteLength; i += chunkSize) {
        controller.enqueue(data.subarray(i, Math.min(i + chunkSize, data.byteLength)));
      }
      controller.close();
    },
  });

const collector = (): { sink: WritableStream<Uint8Array>; collected: () => Uint8Array } => {
  const chunks: Uint8Array[] = [];
  const sink = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(new Uint8Array(chunk));
    },
  });
  return { sink, collected: () => concat(...chunks) };
};

describe("StdioTransport — LSP-style framing", () => {
  it("parses two consecutive envelopes from a single buffer", async () => {
    /* @Given two framed envelopes concatenated in one buffer */
    const a = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "rpc.version", params: {} });
    const b = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "auth.configure",
      params: { password: "x" },
    });
    const data = concat(frame(a), frame(b));

    const transport = new StdioTransport(source(data, 1024), new WritableStream());

    /* @When the incoming stream is drained */
    const received: Request[] = [];
    for await (const req of transport.incoming) received.push(req);

    /* @Then both requests are parsed in order */
    assertEquals(received.length, 2);
    assertEquals(received[0].id, 1);
    assertEquals(received[1].id, 2);
    assertEquals(received[1].method, "auth.configure");
  });

  it("handles envelopes split across read chunks", async () => {
    /* @Given a single envelope fed one byte per chunk */
    const json = JSON.stringify({ jsonrpc: "2.0", id: 99, method: "rpc.version", params: {} });
    const transport = new StdioTransport(source(frame(json), 1), new WritableStream());

    /* @When the incoming stream is drained */
    const received: Request[] = [];
    for await (const req of transport.incoming) received.push(req);

    /* @Then the reassembled request is parsed */
    assertEquals(received.length, 1);
    assertEquals(received[0].id, 99);
  });

  it("serializes concurrent sends without interleaving frames", async () => {
    /* @Given a sink whose write resolves on a later microtask */
    // A sink whose write resolves on a later microtask: an unserialized
    // send() (writer-per-call + separate header/payload writes) would
    // interleave bytes here and corrupt the framing — the exact bug that
    // broke the real CLI under a Promise.all of parallel RPC calls.
    const chunks: Uint8Array[] = [];
    const sink = new WritableStream<Uint8Array>({
      async write(chunk) {
        await Promise.resolve();
        chunks.push(new Uint8Array(chunk));
      },
    });
    const transport = new StdioTransport(new ReadableStream(), sink);

    /* @When 25 responses are sent concurrently and read back */
    const responses: Response[] = Array.from({ length: 25 }, (_, i) => ({
      jsonrpc: "2.0",
      id: i,
      result: { n: i, pad: "x".repeat(i) },
    }));
    await Promise.all(responses.map((r) => transport.send(r)));

    const wire = concat(...chunks);
    const reader = new StdioTransport(source(wire, 7), new WritableStream());
    const received: Request[] = [];
    for await (const req of reader.incoming) received.push(req);

    /* @Then all 25 frames stay intact and in order (no interleaving) */
    assertEquals(received.length, 25);
    assertEquals(received.map((r) => r.id), responses.map((r) => r.id));
  });

  it("encodes responses with the correct Content-Length header", async () => {
    /* @Given a collecting sink and a single response */
    const { sink, collected } = collector();
    const transport = new StdioTransport(new ReadableStream(), sink);

    const response: Response = {
      jsonrpc: "2.0",
      id: 1,
      result: { protocol: "1.0", core: "test-core" },
    };
    /* @When the response is sent */
    await transport.send(response);

    /* @Then the wire bytes carry the correct Content-Length framing */
    const wire = new TextDecoder().decode(collected());
    const expected = JSON.stringify(response);
    assertEquals(
      wire,
      `Content-Length: ${new TextEncoder().encode(expected).byteLength}\r\n\r\n${expected}`,
    );
  });
});
