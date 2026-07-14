export type VirtualMachineTfvars = {
  vmid: number;
  template_id: number;
  ip: string;
  gateway: string;
  dns: string;
  storage: string;
  cores: number;
  memory: number;
  disk: number;
  full: boolean;
  tags: string[];
  start_on_create: boolean;
  user: string;
  password: string;
};

export type RootTfvars = {
  proxmox_host: string;
  proxmox_node: string;
  // proxmox_user / proxmox_password are NOT here on purpose: they are the
  // provider credential and travel via `TF_VAR_*` env (see ProvisioningEnv),
  // so they never land in the tfvars file at rest.
  /**
   * SSH public keys injected via cloud-init `user_account.keys` so the
   * VM is born with the devstation automation key already authorised.
   * Without this, install SSH (`-i devstation_ed25519`) hits
   * `Permission denied (publickey,password)` when the key is absent.
   */
  ssh_public_keys: string[];
  // `vms` is the OpenTofu root variable name (templates keep the IaC name); do not rename.
  vms: Record<string, VirtualMachineTfvars>;
};
