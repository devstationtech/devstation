import { ProxmoxSize } from "@server/size/domain/models/proxmox/proxmox-size.ts";
import { Id } from "@server/size/domain/models/id.ts";
import { Name } from "@server/size/domain/models/name.ts";
import { Cpu } from "@server/size/domain/models/proxmox/cpu.ts";
import { Ram } from "@server/size/domain/models/proxmox/ram.ts";
import { Disk } from "@server/size/domain/models/proxmox/disk.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";

export function creation(user = "test-user", host = "test-host"): Creation {
  return new Creation(new User(user), new Hostname(host), new Instant());
}

export function registeredProxmoxSize(
  name = "small",
  cpu = 2,
  ram = 2048,
  disk = 20,
  user = "test-user",
  host = "test-host",
): ProxmoxSize {
  return ProxmoxSize.register(
    new Id(),
    new Name(name),
    new Cpu(cpu),
    new Ram(ram),
    new Disk(disk),
    creation(user, host),
  );
}
