export class NodeAlreadyExists extends Error {
  constructor(attribute: string) {
    super(`a node with that ${attribute} already exists in this cluster.`);
  }
}
