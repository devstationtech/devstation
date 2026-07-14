/** Progress signal (0–100) emitted by a step's `apply` generator. */
export type Progress = {
  readonly type: "progress";
  readonly percent: number;
  readonly message: string;
};
