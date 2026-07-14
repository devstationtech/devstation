export class VirtualMachineIdInUse extends Error {
  constructor(virtualMachineId: number) {
    super(`vm id ${virtualMachineId} is already in use on this node.`);
  }
}
