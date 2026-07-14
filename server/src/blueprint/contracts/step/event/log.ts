/** Free-form log line emitted by a step's `apply` generator. */
export type Log = {
  readonly type: "log";
  readonly level: "info" | "warn" | "error";
  readonly message: string;
  readonly fields?: Record<string, unknown>;
};
