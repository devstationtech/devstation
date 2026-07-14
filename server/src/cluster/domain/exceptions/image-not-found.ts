export class ImageNotFound extends Error {
  constructor(imageId: string, virtualMachineName: string) {
    super(
      `image '${imageId}' referenced by virtual machine '${virtualMachineName}' not found.`,
    );
  }
}
