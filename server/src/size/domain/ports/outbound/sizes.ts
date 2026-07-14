import type { Size } from "@server/size/domain/models/size.ts";
import type { Id } from "@server/size/domain/models/id.ts";
import type { Name } from "@server/size/domain/models/name.ts";

export interface Sizes {
  of(id: Id): Promise<Size>;
  add(size: Size): Promise<void>;
  exists(name: Name): Promise<boolean>;
  remove(id: Id): Promise<void>;
}
