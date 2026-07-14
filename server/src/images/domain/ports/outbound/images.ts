import type { Image } from "@server/images/domain/models/image.ts";
import type { Id } from "@server/images/domain/models/id.ts";
import type { Name } from "@server/images/domain/models/name.ts";

export interface Images {
  of(id: Id): Promise<Image>;
  add(image: Image): Promise<void>;
  update(image: Image): Promise<void>;
  exists(name: Name): Promise<boolean>;
  remove(id: Id): Promise<void>;
}
