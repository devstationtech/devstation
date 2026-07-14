/**
 * Throwaway test data for MCP e2e tests, as constants. Every entity is named
 * with the `ds-e2e-` prefix the opt-in server policy
 * (`prefix:ds-e2e-,allow:homelab`) requires to permit mutation — so a test
 * can only ever create/destroy its own disposable entities. Names are made
 * unique once per run so a previous run's leftover never collides.
 *
 * A constant holds the STATIC create args; a test merges runtime references
 * (a freshly-created `vaultId`, `nodeId`, …) inline: `{ vaultId, ...SECRET }`.
 */
export const E2E_PREFIX = "ds-e2e-";

/** A prefixed, collision-resistant name for a disposable entity. */
export function uniqueName(kind: string): string {
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  return `${E2E_PREFIX}${kind}-${stamp}`;
}

export const VAULT = { name: uniqueName("vault") };
export const SECRET = { name: uniqueName("secret") };

export const SIZE = {
  name: uniqueName("def"),
  provider: "proxmox",
  cpu: 1,
  ram: 1024,
  disk: 10,
};

export const STATION = { name: uniqueName("station"), description: "e2e station" };
export const SERVICE = { name: uniqueName("svc") };

export const CLUSTER = { name: uniqueName("cluster") };
export const NODE = { name: uniqueName("node"), ip: "10.255.0.10" };
export const IMAGE = {
  name: uniqueName("image"),
  sourceUrl: "https://example.invalid/e2e-image.qcow2",
  os: "ubuntu-22-04",
};

/**
 * A VM's static fields. The runtime references (clusterId, nodeId, the
 * numeric `id`/virtualMachineId, the assigned `image` id, and the credential refs) are
 * merged by the test. The reserved-image virtualMachineId and the VM's own id differ —
 * the aggregate rejects a VM whose id already belongs to an image slot.
 */
export const VM = {
  name: uniqueName("vm"),
  size: "e2e-small",
  ip: "10.255.0.20",
  gateway: "10.255.0.1",
  dns: "1.1.1.1",
  storage: "local-lvm",
  cpu: 1,
  ram: 1024,
  disk: 10,
  tags: [uniqueName("tag")],
};
