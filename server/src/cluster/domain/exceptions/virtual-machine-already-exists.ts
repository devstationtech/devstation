export class VirtualMachineAlreadyExists extends Error {
  constructor(attribute: string) {
    super(`a virtual machine with that ${attribute} already exists in this cluster.`);
  }
}
