import { Uuid } from "@server/shared/building-blocks/domain/models/value-objects/uuid.ts";

/**
 * VM field type for the image it references.
 *
 * Semantic marker: the image must be assigned to the VM's node for
 * the VM to be valid. The invariant itself is enforced by the cluster
 * aggregate (`requireImageAssignedToNode`), but the type name
 * communicates the expectation to readers of the model.
 */
export class AssignedImage extends Uuid {}
