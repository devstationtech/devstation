const REDACTED = "[redacted]";

/**
 * Scrubs secret material from install output before it reaches the execution
 * log. Two complementary rules:
 *
 * - **Publish prefixes**: a step that publishes a secret from a stdout line
 *   (`stdoutLine:` source) prints it as `<prefix><value>`. Any line starting
 *   with a declared prefix is cut at the prefix — the value never streams,
 *   not even before extraction happens.
 * - **Known values**: resolved service secrets and values published earlier
 *   in the run (including peers from previous roles) are replaced wherever
 *   they appear — covers steps that echo them back (`set -x`, debug output,
 *   error messages).
 *
 * `values` is a live provider, not a snapshot: published secrets accumulate
 * while the instance runs, and lines redact against everything known at the
 * moment they stream.
 */
export class SecretRedactor {
  constructor(
    private readonly prefixes: readonly string[],
    private readonly values: () => Iterable<string>,
  ) {}

  /** Redacts a single output line. */
  line(line: string): string {
    let out = line;
    for (const prefix of this.prefixes) {
      const at = out.indexOf(prefix);
      if (at !== -1) out = out.slice(0, at + prefix.length) + REDACTED;
    }
    for (const value of this.values()) {
      // Tiny values would shred unrelated text; anything that short is not
      // a credential worth scrubbing.
      if (value.length < 4) continue;
      out = out.split(value).join(REDACTED);
    }
    return out;
  }

  /** Redacts a multi-line block (captured stdout/stderr, error messages). */
  text(text: string): string {
    return text.split("\n").map((l) => this.line(l)).join("\n");
  }
}
