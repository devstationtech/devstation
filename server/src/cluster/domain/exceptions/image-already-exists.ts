export class ImageAlreadyExists extends Error {
  constructor(field: "id" | "name" | "virtualMachineId") {
    super(`a image with that ${field} already exists.`);
  }
}
