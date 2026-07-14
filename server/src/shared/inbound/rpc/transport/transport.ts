import type { Request } from "@server/shared/inbound/rpc/envelope/request.ts";
import type { Response } from "@server/shared/inbound/rpc/envelope/response/response.ts";
import type { Notification } from "@server/shared/inbound/rpc/envelope/notification.ts";

/**
 * Transport is the wire between Server and its clients.
 *
 * `incoming` yields decoded Request envelopes; `send` encodes/frames a
 * Response or Notification envelope on the way out. The server is
 * unaware of framing.
 */
export interface Transport {
  readonly incoming: AsyncIterable<Request>;
  send(message: Response | Notification<string, unknown>): Promise<void>;
}
