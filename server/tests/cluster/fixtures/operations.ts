import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Gateway } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/gateway.ts";
import { Dns } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/dns.ts";
import { Node as ProxmoxNode } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import { VirtualMachines } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machines.ts";
import { Name as VirtualMachineName } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/name.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Cpu } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/cpu.ts";
import { Ram } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/ram.ts";
import { Disk } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/disk.ts";
import { ProxmoxResources } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/resources.ts";
import { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import { Size } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/size.ts";
import { Tags } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/tags.ts";
import { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import { Name as ImageName } from "@server/cluster/domain/models/proxmox/images/name.ts";
import { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import { NodeImages } from "@server/cluster/domain/models/proxmox/nodes/images/node-images.ts";
import { AssignedImage } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/assigned-image.ts";
import { Source } from "@server/cluster/domain/models/proxmox/images/source.ts";
import { Url } from "@server/cluster/domain/models/proxmox/images/url.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Connection as ProxmoxConnection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import { Secret as VirtualMachinePasswordSecret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";

export function testCredential(
  vaultId = "00000000-0000-0000-0000-000000000001",
  usernameSecretId = "00000000-0000-0000-0000-000000000002",
  passwordSecretId = "00000000-0000-0000-0000-000000000003",
): Credential {
  return new Credential(
    new Vault(vaultId),
    new Secret(usernameSecretId),
    new Secret(passwordSecretId),
  );
}

export function creation(user = "test-user", host = "test-host"): Creation {
  return new Creation(new User(user), new Hostname(host), new Instant());
}

export function register(
  name = "homelab-dev",
  user = "test-user",
  host = "test-host",
): ProxmoxCluster {
  return ProxmoxCluster.register(new Id(), new Name(name), creation(user, host));
}

export function registerNode(
  name = "node-1",
  ip = "192.168.1.1",
): ProxmoxNode {
  return new ProxmoxNode(new NodeId(), new NodeName(name), new Ip(ip), testCredential());
}

export function virtualMachine(
  id = 100,
  vmAddress = "10.0.0.100",
  imageId = "00000000-0000-0000-0000-0000000090a0",
  tags: string[] = ["test-tag"],
): VirtualMachine {
  return new VirtualMachine(
    new VirtualMachineId(id),
    new VirtualMachineName("test-vm"),
    new Size("test-def"),
    new AssignedImage(imageId),
    new ProxmoxResources(new Cpu(1), new Ram(512), new Disk(10)),
    new Network(new Ip(vmAddress), new Gateway("192.168.15.1"), new Dns("192.168.15.1")),
    new Storage("s1"),
    new Vault("00000000-0000-0000-0000-000000000001"),
    new VirtualMachinePasswordSecret("00000000-0000-0000-0000-000000000005"),
    new VirtualMachinePasswordSecret("00000000-0000-0000-0000-000000000004"),
    new Tags(tags),
  );
}

export function proxmoxNodeWithVirtualMachines(
  name = "node-with-vm",
  ip = "10.0.0.1",
): ProxmoxNode {
  return new ProxmoxNode(
    new NodeId(),
    new NodeName(name),
    new Ip(ip),
    testCredential(),
    new NodeImages(),
    new VirtualMachines([virtualMachine()]),
  );
}

export function nodeImage(
  imageId = "00000000-0000-0000-0000-0000000090a0",
  virtualMachineId = 9000,
  storage = "local-lvm",
): NodeImage {
  return new NodeImage(
    new ImageId(imageId),
    new ImageName("ubuntu"),
    OperatingSystem.UBUNTU_22_04,
    new Source(new Url("https://example.com/ubuntu.img")),
    new VirtualMachineId(virtualMachineId),
    new Storage(storage),
  );
}

export function connection(
  host = "192.168.1.1",
  vaultId = "vault-1",
  secretId = "secret-1",
): ProxmoxConnection {
  return new ProxmoxConnection(new Hostname(host), new Vault(vaultId), new Secret(secretId));
}
