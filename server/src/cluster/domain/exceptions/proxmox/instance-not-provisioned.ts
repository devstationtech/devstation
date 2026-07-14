export class InstanceNotProvisioned extends Error {
  constructor(instanceId: number) {
    super(`virtual machine '${instanceId}' is not provisioned yet.`);
  }
}
