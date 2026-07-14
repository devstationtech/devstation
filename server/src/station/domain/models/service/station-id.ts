import { Uuid } from "@server/shared/building-blocks/domain/models/value-objects/uuid.ts";

/**
 * Reference to the parent Station that owns this service. Kept as a
 * discrete value object for back-reference while Service is still
 * embedded inside the Station aggregate's services array.
 */
export class StationId extends Uuid {}
