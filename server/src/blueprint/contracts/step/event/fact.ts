/**
 * Non-secret output emitted by a step's `apply` generator (e.g. the IP a
 * service is bound to, a install URL). Captured in `InstallResult.outputs`,
 * safe to expose in UI.
 */
export type Fact = {
  readonly type: "fact";
  readonly name: string;
  readonly value: string;
};
