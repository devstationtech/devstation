/**
 * Wire identity of an aggregate's event stream.
 *
 * Format: `<aggregate>.v<n>` where:
 *   - `<aggregate>` is a lowercase slug (a-z, 0-9, hyphen; starts with a letter)
 *   - `<n>` is a positive integer version (1+)
 *
 * Examples: `"stations.v1"`, `"clusters.v1"`, `"executions.v1"`.
 *
 * Set per BC in its outbound dispatcher adapter — application handlers
 * never touch topics. When the schema of a topic changes incompatibly,
 * a new `v<n+1>` topic is introduced alongside `v<n>` until consumers
 * migrate.
 */
export class Topic {
  private static readonly PATTERN = /^[a-z][a-z0-9-]*\.v[1-9][0-9]*$/;

  constructor(readonly value: string) {
    if (!Topic.PATTERN.test(value)) {
      throw new Error(
        `Invalid topic '${value}'. Expected format: '<aggregate>.v<n>' (e.g. 'stations.v1').`,
      );
    }
  }
}
