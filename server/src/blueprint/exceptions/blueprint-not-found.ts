import type { Name } from "@server/blueprint/domain/models/name.ts";

export class BlueprintNotFound extends Error {
  constructor(name: Name) {
    super(`stack '${name.value}' not found.`);
  }
}
