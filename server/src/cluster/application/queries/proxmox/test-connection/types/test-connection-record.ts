export type TestConnectionRecord =
  | { ok: true; nodeCount: number }
  | { ok: false; error: string };
