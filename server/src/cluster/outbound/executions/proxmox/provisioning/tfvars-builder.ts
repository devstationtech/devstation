import type {
  RootTfvars,
  VirtualMachineTfvars,
} from "@server/cluster/outbound/executions/proxmox/provisioning/tfvars.ts";
import type { Node } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import type { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import type { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import type { StorageTypeResolver } from "@server/cluster/domain/ports/outbound/storage-type-resolver.ts";
import type { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";
import { isLinked } from "@server/cluster/domain/models/proxmox/connection/clone-mode.ts";

/**
 * Builds the tfvars payload for a provisioning run. The builder reads
 * the shared SSH public key and injects it via `ssh_public_keys`
 * (cloud-init `user_account.keys`), so VMs are born with the automation
 * key already authorized. Without this, the key-only SSH install step
 * fails with `Permission denied (publickey,password)` because cloud-init
 * never added the key. Existing VMs require destroy + apply to pick up
 * the key (cloud-init only runs on first boot).
 *
 * The Proxmox provider credential is deliberately absent from the tfvars —
 * it is supplied to the runtime as `TF_VAR_*` env (see `ProvisioningEnv`)
 * so it never rests on disk.
 */
export class TfvarsBuilder {
  constructor(
    private readonly secretResolver: SecretResolver,
    private readonly storageResolver: StorageTypeResolver,
    private readonly identity: IdentityProvider,
  ) {}

  async build(
    connection: Connection,
    node: Node,
    virtualMachines: readonly VirtualMachine[],
  ): Promise<RootTfvars> {
    const sshPublicKey = await this.identity.publicKey();
    // One storage lookup per node; AUTO resolves clone mode per VM target
    // datastore (CoW → linked; non-CoW/unknown → full).
    const storageTypes = await this.storageResolver.resolve(connection, node.name.value);
    const vms: Record<string, VirtualMachineTfvars> = {};
    for (const vm of virtualMachines) {
      const assigned = node.images.of(vm.image);
      const vault = vm.credentialVault;
      const user = await this.secretResolver.resolve(vault, vm.usernameSecret);
      if (user === null) {
        throw new Error(
          `unable to resolve username secret for vm ${vm.name.value} on node ${node.name.value} (secret ${vm.usernameSecret.value} in vault ${vault.value})`,
        );
      }
      const password = await this.secretResolver.resolve(vault, vm.passwordSecret);
      if (password === null) {
        throw new Error(
          `unable to resolve password secret for vm ${vm.name.value} on node ${node.name.value} (secret ${vm.passwordSecret.value} in vault ${vault.value})`,
        );
      }
      vms[vm.name.value] = {
        vmid: vm.id.value,
        template_id: assigned.virtualMachineId.value,
        ip: vm.network.ip.value,
        gateway: vm.network.gateway.value,
        dns: vm.network.dns.value,
        storage: vm.storage.value,
        cores: vm.resources.cpu.value,
        memory: vm.resources.ram.value,
        disk: vm.resources.disk.value,
        full: !isLinked(
          storageTypes.get(vm.storage.value) ?? null,
          connection.policy.cloneStrategy,
        ),
        // Baseline `devstation` marker + the VM's free tags.
        tags: [...new Set(["devstation", ...vm.tags.values])],
        start_on_create: true,
        user,
        password,
      };
    }
    return {
      proxmox_host: connection.host.value,
      proxmox_node: node.name.value,
      ssh_public_keys: [sshPublicKey],
      vms,
    };
  }
}
