/**
 * @jsonrpc-client — generic TypeScript client for JSON-RPC 2.0 servers over stdio.
 *
 * Transport primitives, envelope types, error handling, and a long-lived
 * subprocess implementation. This package knows NOTHING about DevStation —
 * it would work the same for any stdio JSON-RPC server. Project-specific
 * typed facades (AuthClient, etc.) live in `@jsonrpc-contracts-ts/`.
 *
 * Example:
 *
 *   import { Client, SubprocessCall } from "@jsonrpc-client-ts/mod.ts";
 *
 *   import { denoSpawn } from "@jsonrpc-client-ts/deno-spawn.ts"; // Deno consumers
 *   const subprocess = new SubprocessCall("./bin/your-core", [], denoSpawn);
 *   const rpc = new Client((request) => subprocess.send(request));
 *
 *   const result = await rpc.invoke<{ status: string }>("ping", {});
 */

// Transport primitives
export type { Call } from "@jsonrpc-client-ts/call.ts";
export type { Channel } from "@jsonrpc-client-ts/channel.ts";
export { Client } from "@jsonrpc-client-ts/client.ts";
export { SubprocessCall } from "@jsonrpc-client-ts/subprocess-call.ts";
export type { Spawn, SpawnedProcess } from "@jsonrpc-client-ts/spawn.ts";

// Error handling
export { Exception } from "@jsonrpc-client-ts/exception.ts";
export { ErrorCode } from "@jsonrpc-client-ts/error/error-code.ts";

// Envelope shapes (the wire contract — JSON-RPC 2.0 standard)
export type { Id } from "@jsonrpc-client-ts/envelope/id.ts";
export type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
export type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
export type { Success } from "@jsonrpc-client-ts/envelope/response/success.ts";
export type { Failure } from "@jsonrpc-client-ts/envelope/response/failure.ts";
export type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
