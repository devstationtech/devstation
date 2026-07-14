import type { Provider } from "@server/shared/building-blocks/domain/models/value-objects/provider.ts";
import type { Id } from "@server/size/domain/models/id.ts";
import type { Name } from "@server/size/domain/models/name.ts";

export interface Size {
  readonly id: Id;
  readonly name: Name;
  readonly provider: Provider;
}
