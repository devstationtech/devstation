/**
 * Projection of one service running on a VM. Source of truth lives in the
 * service bounded context; this record is the read-side view exposed to the
 * cluster UI ("what's running here?").
 */
export type VirtualMachineServiceRecord = {
  serviceId: string;
  serviceName: string;
  blueprint: string;
  role: string;
  installedAt: string;
};
