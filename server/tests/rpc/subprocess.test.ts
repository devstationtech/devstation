/**
 * End-to-end test that proves devstation-server is callable as a real
 * subprocess from any client — Go, Electron, Web, or another Deno process.
 *
 * Spawns the actual `bin/devstation-server` executable — the same
 * entry the UI's RpcClientsProvider launches — exchanges raw JSON-RPC
 * 2.0 envelopes over stdio with LSP-style Content-Length framing, and
 * asserts the same behavior the in-process server tests verify. If
 * this test passes, the contract works cross-process — which is the
 * precondition for a Go TUI.
 *
 * Regression: the bin must spawn cleanly. It once imported a removed
 * entry module (`rpc-server-entry.ts`) and crashed on launch, so the
 * UI exited the instant any screen behind AuthGate issued its first
 * RPC call.
 */
import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { ErrorCode } from "@server/shared/inbound/rpc/error/error-code.ts";
import type { Success } from "@server/shared/inbound/rpc/envelope/response/success.ts";
import type { Failure } from "@server/shared/inbound/rpc/envelope/response/failure.ts";
import type { Response } from "@server/shared/inbound/rpc/envelope/response/response.ts";

class RpcSubprocess {
  private child!: Deno.ChildProcess;
  private reader!: ReadableStreamDefaultReader<Uint8Array>;
  private writer!: WritableStreamDefaultWriter<Uint8Array>;
  private buffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
  private nextId = 0;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  // deno-lint-ignore require-await -- awaited by callers; keeps the Promise contract
  async start(env: Record<string, string>): Promise<void> {
    this.child = new Deno.Command("deno", {
      args: ["run", "-A", "server/bin/devstation-server"],
      stdin: "piped",
      stdout: "piped",
      stderr: "null",
      env,
    }).spawn();
    this.reader = this.child.stdout.getReader();
    this.writer = this.child.stdin.getWriter();
  }

  async stop(): Promise<void> {
    try {
      this.writer.releaseLock();
      await this.child.stdin.close();
    } catch {
      // already closed
    }
    try {
      this.reader.releaseLock();
      await this.child.stdout.cancel();
    } catch {
      // already closed
    }
    try {
      this.child.kill("SIGTERM");
    } catch {
      // already exited
    }
    await this.child.status;
  }

  async call(method: string, params: unknown): Promise<Response> {
    const id = ++this.nextId;
    const payload = this.encoder.encode(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    const header = this.encoder.encode(`Content-Length: ${payload.byteLength}\r\n\r\n`);
    await this.writer.write(header);
    await this.writer.write(payload);
    return await this.receive();
  }

  /**
   * Pipelines every request back-to-back without reading in between, then
   * collects all responses and correlates them by id. This is the shape
   * that broke the real CLI: the server reads many frames from one buffer
   * and writes the responses concurrently — if its stdio send isn't
   * serialized + atomic, the frames interleave on the wire and the client
   * parses garbage. Responses may arrive in any order; we re-key by id.
   */
  async callConcurrent(
    specs: readonly { method: string; params: unknown }[],
  ): Promise<Response[]> {
    const ids = specs.map(() => ++this.nextId);
    await Promise.all(
      specs.map((s, i) => {
        const payload = this.encoder.encode(
          JSON.stringify({ jsonrpc: "2.0", id: ids[i], method: s.method, params: s.params }),
        );
        const header = this.encoder.encode(`Content-Length: ${payload.byteLength}\r\n\r\n`);
        const frame = this.concat(header, payload);
        return this.writer.write(frame);
      }),
    );
    const byId = new Map<number, Response>();
    for (let i = 0; i < specs.length; i++) {
      const r = await this.receive();
      byId.set((r as { id: number }).id, r);
    }
    return ids.map((id) => byId.get(id)!);
  }

  private async receive(): Promise<Response> {
    while (true) {
      const sep = this.indexOf(this.buffer, HEADER_TERMINATOR);
      if (sep === -1) {
        const { value, done } = await this.reader.read();
        if (done) throw new Error("subprocess closed stdout unexpectedly");
        this.buffer = this.concat(this.buffer, value);
        continue;
      }

      const length = parseContentLength(this.decoder.decode(this.buffer.subarray(0, sep)));
      if (length === null) {
        this.buffer = this.buffer.subarray(sep + HEADER_TERMINATOR.length) as Uint8Array<
          ArrayBuffer
        >;
        continue;
      }

      const start = sep + HEADER_TERMINATOR.length;
      const end = start + length;
      while (this.buffer.byteLength < end) {
        const { value, done } = await this.reader.read();
        if (done) throw new Error("subprocess closed stdout mid-payload");
        this.buffer = this.concat(this.buffer, value);
      }

      const payload = this.decoder.decode(this.buffer.subarray(start, end));
      this.buffer = this.buffer.subarray(end) as Uint8Array<ArrayBuffer>;
      return JSON.parse(payload) as Response;
    }
  }

  private concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(new ArrayBuffer(a.byteLength + b.byteLength));
    out.set(a, 0);
    out.set(b, a.byteLength);
    return out;
  }

  private indexOf(haystack: Uint8Array, needle: Uint8Array): number {
    outer: for (let i = 0; i <= haystack.byteLength - needle.byteLength; i++) {
      for (let j = 0; j < needle.byteLength; j++) {
        if (haystack[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }
}

const HEADER_TERMINATOR = new TextEncoder().encode("\r\n\r\n");

const parseContentLength = (header: string): number | null => {
  for (const line of header.split(/\r?\n/)) {
    const match = line.match(/^Content-Length:\s*(\d+)\s*$/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
};

describe("devstation-server subprocess — JSON-RPC 2.0 over stdio", () => {
  let core: RpcSubprocess;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir({ prefix: "devstation-server-test-" });
    core = new RpcSubprocess();
    await core.start({ DEVSTATION_HOME: tempDir });
  });

  afterEach(async () => {
    await core.stop();
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  });

  it("answers rpc.version with the protocol handshake", async () => {
    /* @Given a freshly spawned devstation-server subprocess */
    /* @When  a client sends rpc.version over stdin */
    const response = await core.call("rpc.version", {}) as Success<{
      protocol: string;
      core: string;
    }>;

    /* @Then  it replies on stdout with the protocol version */
    assertEquals(response.jsonrpc, "2.0");
    assertEquals(response.result.protocol, "1.0");
  });

  it("exchanges the full auth flow: configure → authenticate → renew", async () => {
    /* @Given a Go-like client speaking JSON-RPC */
    /* @When  it configures, authenticates, and renews */
    const configured = await core.call("auth.configure", {
      password: "subprocess-poc-password",
    }) as Success<{ sessionId: string; expiresAt: string }>;

    const authenticated = await core.call("auth.authenticate", {
      password: "subprocess-poc-password",
    }) as Success<{ sessionId: string; expiresAt: string }>;

    const renewed = await core.call("auth.renew", {
      sessionId: authenticated.result.sessionId,
    }) as Success<{ sessionId: string; expiresAt: string }>;

    /* @Then  each call returns a populated session envelope */
    assertEquals(configured.result.sessionId.length, 36);
    assertEquals(authenticated.result.sessionId.length, 36);
    assertEquals(renewed.result.sessionId.length, 36);
  });

  it("returns -32000 unauthenticated when renew receives an unknown sessionId", async () => {
    /* @Given the subprocess is configured */
    await core.call("auth.configure", { password: "subprocess-poc-password" });

    /* @When  the client renews with an invalid sessionId */
    const response = await core.call("auth.renew", {
      sessionId: "00000000-0000-0000-0000-000000000000",
    }) as Failure;

    /* @Then  the wire carries JSON-RPC code -32000 */
    assertEquals(response.error.code, ErrorCode.UNAUTHENTICATED);
    assertEquals(response.error.message, "unauthenticated");
  });

  it("handles many pipelined concurrent requests without frame corruption", async () => {
    /* @Given the subprocess is configured (so auth.configured is true) */
    await core.call("auth.configure", { password: "subprocess-poc-password" });

    /* @When  30 requests are pipelined back-to-back over one stdio pipe.
       This is the exact scenario that hung the real CLI post-auth (a
       Promise.all of cluster calls + stats polling): the server reads
       many frames from one buffer and writes responses concurrently. */
    const specs = Array.from(
      { length: 30 },
      (_, i) =>
        i % 2 === 0
          ? { method: "rpc.version", params: {} }
          : { method: "auth.configured", params: {} },
    );
    const responses = await core.callConcurrent(specs);

    /* @Then  every request gets its own well-formed, id-correlated reply
       (no SyntaxError from a payload that still holds the next header). */
    assertEquals(responses.length, 30);
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i] as Success<unknown> | Failure;
      assertEquals("error" in r, false);
      if (i % 2 === 0) {
        assertEquals((r as Success<{ protocol: string }>).result.protocol, "1.0");
      } else {
        assertEquals((r as Success<boolean>).result, true);
      }
    }
  });
});
