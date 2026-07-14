export class NodeCredentialMissing extends Error {
  constructor(nodeName: string) {
    super(`node '${nodeName}' has no credential configured.`);
  }
}
