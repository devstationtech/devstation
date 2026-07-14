import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";

/**
 * One-shot RPC call hook.
 *
 * Today: subprocess (SubprocessCall pipes the envelope through stdio).
 * Tomorrow: WebSocket / Unix socket / etc. The UI sees one interface; the
 * transport is swapped at composition time.
 */
export type Call = (request: Request) => Promise<Response>;
