import { Image } from "@server/images/domain/models/image.ts";
import { Id } from "@server/images/domain/models/id.ts";
import { Name } from "@server/images/domain/models/name.ts";
import { Source } from "@server/images/domain/models/source.ts";
import { Url } from "@server/images/domain/models/url.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";

export function creation(user = "test-user", host = "test-host"): Creation {
  return new Creation(new User(user), new Hostname(host), new Instant());
}

export function registeredImage(
  name = "ubuntu-cloud",
  os: OperatingSystem = OperatingSystem.UBUNTU_22_04,
  sourceUrl = "https://example.com/ubuntu-22.04.img",
  user = "test-user",
  host = "test-host",
): Image {
  return Image.register(
    new Id(),
    new Name(name),
    os,
    new Source(new Url(sourceUrl)),
    creation(user, host),
  );
}
