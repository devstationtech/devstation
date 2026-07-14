export class ImageAlreadyAssigned extends Error {
  constructor(imageId: string) {
    super(`image '${imageId}' is already assigned to this node.`);
  }
}
