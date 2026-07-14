import { Uuid } from "@server/shared/building-blocks/domain/models/value-objects/uuid.ts";

/**
 * Reference to a vault aggregate (owned by the vault BC). Used by other
 * contexts that store credentials/secrets without hosting the vault itself.
 */
export class Vault extends Uuid {}
