import type { RegisterSize } from "@server/size/application/commands/register-size.ts";
import type { Size } from "@server/size/domain/models/size.ts";
import { Provider } from "@server/shared/building-blocks/domain/models/value-objects/provider.ts";
import { ProxmoxSize } from "@server/size/domain/models/proxmox/proxmox-size.ts";
import { Id } from "@server/size/domain/models/id.ts";
import { Name } from "@server/size/domain/models/name.ts";
import { Cpu } from "@server/size/domain/models/proxmox/cpu.ts";
import { Ram } from "@server/size/domain/models/proxmox/ram.ts";
import { Disk } from "@server/size/domain/models/proxmox/disk.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { UnsupportedProvider } from "@server/size/domain/exceptions/unsupported-provider.ts";

export class SizeFactory {
  static build(command: RegisterSize): Size {
    const id = new Id();
    const name = new Name(command.name);
    const creation = new Creation(
      new User(command.user),
      new Hostname(command.host),
      new Instant(),
    );

    if (command.provider === Provider.PROXMOX) {
      return ProxmoxSize.register(
        id,
        name,
        new Cpu(command.cpu),
        new Ram(command.ram),
        new Disk(command.disk),
        creation,
      );
    }

    throw new UnsupportedProvider(command.provider);
  }
}
