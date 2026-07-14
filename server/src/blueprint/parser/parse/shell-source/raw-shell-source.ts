/**
 * Untrusted shape of a step's shell declaration. Either an inline `run:` or
 * a sibling `script:` path — never both, never neither (the parser enforces).
 */
export type RawShellSource = {
  run?: unknown;
  script?: unknown;
};
