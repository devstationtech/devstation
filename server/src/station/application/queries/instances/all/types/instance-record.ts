/**
 * Cross-provider VM projection used by the service register form to pick
 * instances per role. Today only proxmox feeds this; the shape is generic so
 * future providers slot in without UI changes.
 *
 * `busy`/`busyBy` cross-references the Service domain (write-side) — the
 * source of truth for "which VM is occupied by which service". The cluster's
 * `vm.services` projection is read-side display only and is NOT consulted
 * here.
 */
export type InstanceRecord = {
  /** Provider-qualified id (e.g. `"proxmox:<clusterId>:<vmid>"`). */
  id: string;
  name: string;
  host: string;
  os: string;
  provider: string;
  cluster: { id: string; name: string };
  node: { id: string; name: string };
  specs: { cpu: number; ram: number; disk: number };
  /** Vault holding this VM's credential secrets (provider-managed). */
  credentialVaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
  busy: boolean;
  busyBy: { serviceId: string; serviceName: string; role: string } | null;
};
