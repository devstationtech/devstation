import { Slug } from "@server/shared/building-blocks/domain/models/value-objects/slug.ts";

/**
 * Reference (by name) to a stack module loaded from disk. Stored on the
 * service so the installer adapter can resolve the actual stack at install
 * time. The service never holds the stack body — only the name.
 */
export class BlueprintName extends Slug {}
