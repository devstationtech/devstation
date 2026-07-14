/**
 * Station BC — MCP endpoint catalog.
 *
 * Same Query/Handler instances the station RPC endpoints already
 * receive — handler-direct dispatch (no JSON-RPC envelope).
 */
export { ListStationsMcpEndpoint } from "@server/station/inbound/mcp/list/endpoint.ts";
export { StationByIdMcpEndpoint } from "@server/station/inbound/mcp/by-id/endpoint.ts";
export { ListServicesMcpEndpoint } from "@server/station/inbound/mcp/services/list/endpoint.ts";
export { ListInstancesMcpEndpoint } from "@server/station/inbound/mcp/instances/list/endpoint.ts";
export { InstallStationMcpEndpoint } from "@server/station/inbound/mcp/install/endpoint.ts";
export { UninstallStationMcpEndpoint } from "@server/station/inbound/mcp/uninstall/endpoint.ts";
// Write endpoints (mirror of RPC write surface)
export { RegisterStationMcpEndpoint } from "@server/station/inbound/mcp/register/endpoint.ts";
export { UpdateStationMcpEndpoint } from "@server/station/inbound/mcp/update/endpoint.ts";
export { UnregisterStationMcpEndpoint } from "@server/station/inbound/mcp/unregister/endpoint.ts";
export { RegisterServiceMcpEndpoint } from "@server/station/inbound/mcp/services/register/endpoint.ts";
export { UnregisterServiceMcpEndpoint } from "@server/station/inbound/mcp/services/unregister/endpoint.ts";
// Service read endpoints
// NOTE: devstation_station_services_list_all is SKIPPED — the RPC station.services.list uses
// AllServicesQuery, which is already exposed as devstation_station_services_list (identical query).
export { ServicesByBlueprintMcpEndpoint } from "@server/station/inbound/mcp/services/by-blueprint/endpoint.ts";
export { ServiceByIdMcpEndpoint } from "@server/station/inbound/mcp/services/by-id/endpoint.ts";
export { ServicesByStationMcpEndpoint } from "@server/station/inbound/mcp/services/by-station/endpoint.ts";
// Resources
export { StationsResource } from "@server/station/inbound/mcp/resources/stations.ts";
export { ServicesResource } from "@server/station/inbound/mcp/resources/services.ts";
