/**
 * Server-emitted notification envelope for future streaming support.
 *
 * Defined here so the shape is stable before any BC starts emitting
 * notifications. Currently unused — kept as the canonical type when
 * subscriptions land.
 */
export class Notification<M extends string, P> {
  readonly jsonrpc = "2.0" as const;

  private constructor(readonly method: M, readonly params: P) {}

  static of<M extends string, P>(method: M, params: P): Notification<M, P> {
    return new Notification(method, params);
  }
}
