/**
 * Station BC — RPC endpoint catalog.
 *
 * Every method is protected. `station.install` is long-running and
 * returns `{ executionId }` (LSP-style streaming via operation.event,
 * same as the cluster provisioning endpoints).
 */
export { RegisterStationEndpoint } from "@server/station/inbound/rpc/register/endpoint.ts";
export { UpdateStationEndpoint } from "@server/station/inbound/rpc/update/endpoint.ts";
export { UnregisterStationEndpoint } from "@server/station/inbound/rpc/unregister/endpoint.ts";
export { RegisterServiceEndpoint } from "@server/station/inbound/rpc/services/register/endpoint.ts";
export { UnregisterServiceEndpoint } from "@server/station/inbound/rpc/services/unregister/endpoint.ts";
export { InstallStationEndpoint } from "@server/station/inbound/rpc/install/endpoint.ts";
export { UninstallStationEndpoint } from "@server/station/inbound/rpc/uninstall/endpoint.ts";
export { ListStationsEndpoint } from "@server/station/inbound/rpc/list/endpoint.ts";
export { StationByIdEndpoint } from "@server/station/inbound/rpc/by-id/endpoint.ts";
export { ListInstancesEndpoint } from "@server/station/inbound/rpc/instances/list/endpoint.ts";
export { ListServicesEndpoint } from "@server/station/inbound/rpc/services/list/endpoint.ts";
export { ServicesByBlueprintEndpoint } from "@server/station/inbound/rpc/services/by-blueprint/endpoint.ts";
export { ServiceByIdEndpoint } from "@server/station/inbound/rpc/services/by-id/endpoint.ts";
export { ServicesByStationEndpoint } from "@server/station/inbound/rpc/services/by-station/endpoint.ts";
