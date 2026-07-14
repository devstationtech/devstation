/**
 * JSON-Schema fragment for fields backed by the domain `Slug` VO
 * (cluster name, vault name, size name, station name, etc.).
 *
 * Why centralize:
 *   - LLM agents that passed underscores, uppercase letters, or dots
 *     only learned the constraint by failing at the handler. Publishing
 *     `pattern` + `description` on the wire schema lets the agent's
 *     planner reject invalid inputs up-front.
 *   - The regex matches `server/src/shared/building-blocks/domain/
 *     models/value-objects/slug.ts` verbatim — if the VO ever loosens
 *     or tightens, both files must move together.
 */
export const SLUG_PATTERN = "^[a-z0-9]([a-z0-9-]*[a-z0-9])?$";
export const SLUG_MAX_LENGTH = 64;

export const SLUG_DESCRIPTION =
  "Lowercase slug — letters, digits and hyphens only (must start and end with a letter or digit). Max 64 chars.";

export function slugSchema(extra?: { description?: string }): {
  type: "string";
  pattern: string;
  maxLength: number;
  description: string;
} {
  return {
    type: "string",
    pattern: SLUG_PATTERN,
    maxLength: SLUG_MAX_LENGTH,
    description: extra?.description ?? SLUG_DESCRIPTION,
  };
}
