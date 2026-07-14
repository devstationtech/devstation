export class NodeHasVirtualMachines extends Error {
  constructor() {
    super("cannot remove node with active virtualMachines.");
  }
}
