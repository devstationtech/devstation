/**
 * Minimal MCP stdio client. Spawns any MCP server as a subprocess and
 * talks to it over newline-delimited JSON-RPC. Server-agnostic — the
 * caller supplies the command to spawn; this client knows nothing
 * about which server or which tools.
 *
 * Keeps the surface tiny on purpose: `call` (tool with args) returns
 * the raw text + isError; `parsed` JSON-parses it; `readResource` reads a
 * resource uri. Tests orchestrate it directly.
 */
export interface CallResult {
  readonly isError: boolean;
  readonly text: string;
}

export interface SpawnOptions {
  /** Command vector to spawn the MCP server (e.g. `["my-mcp", "serve"]`). */
  readonly serverCmd: readonly string[];
  /** Extra/override env for the spawned server (merged with process env). */
  readonly env?: Record<string, string>;
  /** Capture stderr (server log) to this writer. */
  readonly stderr?: (chunk: string) => void;
}

interface Pending {
  resolve(value: unknown): void;
  reject(err: Error): void;
}

export class McpClient {
  private nextId = 0;
  private buf = "";
  private readonly pending = new Map<number, Pending>();
  private closed = false;

  private constructor(
    private readonly process: Deno.ChildProcess,
    private readonly writer: WritableStreamDefaultWriter<Uint8Array>,
  ) {}

  static async spawn(opts: SpawnOptions): Promise<McpClient> {
    if (opts.serverCmd.length === 0) {
      throw new Error("McpClient.spawn: serverCmd is required and must be non-empty.");
    }
    const [cmd, ...args] = opts.serverCmd;
    const env = { ...Deno.env.toObject(), ...(opts.env ?? {}) };
    const process = new Deno.Command(cmd, {
      args,
      env,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    const client = new McpClient(process, process.stdin.getWriter());
    void client.pumpStdout(process.stdout.getReader());
    if (opts.stderr) void client.pumpStderr(process.stderr.getReader(), opts.stderr);

    await client.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "@mcp-test-harness", version: "0.1.0" },
    });
    await client.notify("notifications/initialized");
    return client;
  }

  async call(tool: string, args: Record<string, unknown>): Promise<CallResult> {
    const r = await this.rpc("tools/call", { name: tool, arguments: args }) as {
      content?: Array<{ text: string }>;
      isError?: boolean;
    };
    return {
      isError: r.isError ?? false,
      text: r.content?.[0]?.text ?? "",
    };
  }

  /** Same as `call`, but JSON-parses the text. Throws on isError. */
  async parsed<T = unknown>(tool: string, args: Record<string, unknown>): Promise<T> {
    const r = await this.call(tool, args);
    if (r.isError) throw new Error(`${tool}: ${r.text}`);
    return JSON.parse(r.text) as T;
  }

  /**
   * Reads an MCP resource by uri (`resources/read`) and returns the first
   * content block's text — the read-only sibling of `call`. A test asserts
   * the server exposes a uri and yields parseable content.
   */
  async readResource(uri: string): Promise<string> {
    const r = await this.rpc("resources/read", { uri }) as {
      contents?: Array<{ text?: string }>;
    };
    return r.contents?.[0]?.text ?? "";
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.writer.close();
    } catch { /* */ }
    try {
      this.process.kill();
    } catch { /* */ }
    await this.process.status;
  }

  // ── internals ──

  private async rpc(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.nextId;
    const msg = { jsonrpc: "2.0", id, method, params };
    const pending = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    await this.writer.write(new TextEncoder().encode(JSON.stringify(msg) + "\n"));
    return pending;
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    const msg = { jsonrpc: "2.0", method, params };
    await this.writer.write(new TextEncoder().encode(JSON.stringify(msg) + "\n"));
  }

  private async pumpStdout(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      this.buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, nl).trim();
        this.buf = this.buf.slice(nl + 1);
        if (!line) continue;
        let msg: { id?: number; result?: unknown; error?: { code: number; message: string } };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id == null) continue;
        const p = this.pending.get(msg.id);
        if (!p) continue;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`rpc error ${msg.error.code}: ${msg.error.message}`));
        else p.resolve(msg.result);
      }
    }
    for (const p of this.pending.values()) p.reject(new Error("server stream ended"));
    this.pending.clear();
  }

  private async pumpStderr(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    out: (chunk: string) => void,
  ): Promise<void> {
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      out(dec.decode(value, { stream: true }));
    }
  }
}
