# @jsonrpc-client

Generic TypeScript client for **any** JSON-RPC 2.0 server over stdio. Project-agnostic; would work
the same against a stdio LSP server, a custom RPC daemon, or your own core.

Project-specific typed facades (this DevStation project's `AuthClient`, etc.) live in
[`@jsonrpc-contracts-ts/`](../devstation-client/README.md), which depends on this package.

## What's inside

| Module           | Purpose                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `Client`         | Generic typed client. Takes an `Call` (the transport hook) and exposes `invoke(method, request)`.          |
| `Call` (type)    | One-shot function signature: `(Request) => Promise<Response>`. Each transport implementation provides one. |
| `SubprocessCall` | Long-lived stdio subprocess implementation. Spawns a server binary once, multiplexes calls by id.          |
| `Exception`      | Thrown when the server returns an error envelope. Carries the numeric JSON-RPC error code.                 |
| `ErrorCode`      | JSON-RPC 2.0 standard codes plus the customizable domain range.                                            |
| `envelope/*`     | Plain TS types describing the wire shape (Request, OkResponse, ErrorResponse — JSON-RPC 2.0 standard).     |

## What's NOT here

- No method names. The package doesn't know your server's surface; you bring that.
- No project-specific types. Those go in a sibling package or your project.
- No subprocess discovery convention. Each consumer decides how to locate its server binary.

## Usage

```ts
import { Client, ErrorCode, Exception, SubprocessCall } from "@jsonrpc-client-ts/mod.ts";

const subprocess = new SubprocessCall("./bin/your-server");
const rpc = new Client((request) => subprocess.send(request));

try {
  const result = await rpc.invoke<{ ok: boolean }>("ping", {});
  console.log(result.ok);
} catch (error) {
  if (error instanceof Exception && error.code === ErrorCode.UNAUTHENTICATED) {
    // handle expired session
  }
  throw error;
}

await subprocess.shutdown();
```

## Conventions

- **No imports from `src/`** — this package is transport-and-type only. Arch tests enforce that.
- **No imports from `cli/`** — UI-specific composition (env var resolution, React Context wiring)
  lives in the consumer.
- **Wire-format types only** — anything project-specific belongs in a downstream package.
