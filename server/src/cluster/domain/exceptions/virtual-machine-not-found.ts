export class VirtualMachineNotFound extends Error {
  constructor() {
    super("virtual machine not found.");
  }
}
