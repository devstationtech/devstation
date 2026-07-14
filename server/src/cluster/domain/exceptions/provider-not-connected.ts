export class ProviderNotConnected extends Error {
  constructor() {
    super("cluster has no proxmox connection.");
  }
}
