export class ImageNotAssigned extends Error {
  constructor(imageId: string) {
    super(`image '${imageId}' is not assigned to this node.`);
  }
}
