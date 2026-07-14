import type { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import type { Id } from "@server/cluster/domain/models/id.ts";
import type { Name } from "@server/cluster/domain/models/name.ts";
import type { Provider } from "@server/cluster/domain/models/provider.ts";

export interface Cluster {
  readonly id: Id;
  readonly name: Name;
  readonly version: Version;
  readonly creation: Creation;
  readonly provider: Provider;
}
