/**
 * Re-exports of blueprint's published language consumed by station's
 * application + outbound layers. Treating these as the explicit
 * cross-BC surface keeps domain models and handlers free of direct
 * `@server/blueprint/...` imports — the contracts/ folder is the
 * only sanctioned bridge.
 */
export type { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
export { Name as BlueprintName } from "@server/blueprint/domain/models/name.ts";
