import { Uuid } from "@server/shared/building-blocks/domain/models/value-objects/uuid.ts";

/**
 * Reference to a secret entity inside a Vault. Plaintext lives only in the
 * vault BC; other contexts carry the identifier and resolve via SecretResolver.
 */
export class Secret extends Uuid {}
