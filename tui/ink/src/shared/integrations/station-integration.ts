import type {
  StationByIdRequest,
  StationByIdResponse,
  StationInstallRequest,
  StationInstallResponse,
  StationInstancesListRequest,
  StationInstancesListResponse,
  StationListRequest,
  StationListResponse,
  StationRegisterRequest,
  StationRegisterResponse,
  StationServicesByBlueprintRequest,
  StationServicesByBlueprintResponse,
  StationServicesByIdRequest,
  StationServicesByIdResponse,
  StationServicesByStationRequest,
  StationServicesByStationResponse,
  StationServicesListRequest,
  StationServicesListResponse,
  StationServicesRegisterRequest,
  StationServicesRegisterResponse,
  StationServicesUnregisterRequest,
  StationServicesUnregisterResponse,
  StationUninstallRequest,
  StationUninstallResponse,
  StationUnregisterRequest,
  StationUnregisterResponse,
  StationUpdateRequest,
  StationUpdateResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

/**
 * Integration for the `station.*` RPC surface.
 *
 * Every method is protected — the caller must include a valid sessionId in
 * the Request. The endpoint resolves the session at the wire boundary.
 *
 * `install` returns `{ executionId }` immediately; attach to progress via
 * `ExecutionsIntegration.watch({ executionId })`.
 */
export class StationIntegration {
  constructor(private readonly rpc: Client) {}

  list(request: StationListRequest): Promise<StationListResponse> {
    return this.rpc.invoke<StationListResponse>("station.list", request);
  }

  byId(request: StationByIdRequest): Promise<StationByIdResponse> {
    return this.rpc.invoke<StationByIdResponse>("station.byId", request);
  }

  register(request: StationRegisterRequest): Promise<StationRegisterResponse> {
    return this.rpc.invoke<StationRegisterResponse>("station.register", request);
  }

  update(request: StationUpdateRequest): Promise<StationUpdateResponse> {
    return this.rpc.invoke<StationUpdateResponse>("station.update", request);
  }

  unregister(request: StationUnregisterRequest): Promise<StationUnregisterResponse> {
    return this.rpc.invoke<StationUnregisterResponse>("station.unregister", request);
  }

  install(request: StationInstallRequest): Promise<StationInstallResponse> {
    return this.rpc.invoke<StationInstallResponse>("station.install", request);
  }

  uninstall(request: StationUninstallRequest): Promise<StationUninstallResponse> {
    return this.rpc.invoke<StationUninstallResponse>("station.uninstall", request);
  }

  instancesList(
    request: StationInstancesListRequest,
  ): Promise<StationInstancesListResponse> {
    return this.rpc.invoke<StationInstancesListResponse>(
      "station.instances.list",
      request,
    );
  }

  servicesList(
    request: StationServicesListRequest,
  ): Promise<StationServicesListResponse> {
    return this.rpc.invoke<StationServicesListResponse>(
      "station.services.list",
      request,
    );
  }

  servicesByStation(
    request: StationServicesByStationRequest,
  ): Promise<StationServicesByStationResponse> {
    return this.rpc.invoke<StationServicesByStationResponse>(
      "station.services.byStation",
      request,
    );
  }

  servicesById(
    request: StationServicesByIdRequest,
  ): Promise<StationServicesByIdResponse> {
    return this.rpc.invoke<StationServicesByIdResponse>(
      "station.services.byId",
      request,
    );
  }

  servicesByBlueprint(
    request: StationServicesByBlueprintRequest,
  ): Promise<StationServicesByBlueprintResponse> {
    return this.rpc.invoke<StationServicesByBlueprintResponse>(
      "station.services.byBlueprint",
      request,
    );
  }

  servicesRegister(
    request: StationServicesRegisterRequest,
  ): Promise<StationServicesRegisterResponse> {
    return this.rpc.invoke<StationServicesRegisterResponse>(
      "station.services.register",
      request,
    );
  }

  servicesUnregister(
    request: StationServicesUnregisterRequest,
  ): Promise<StationServicesUnregisterResponse> {
    return this.rpc.invoke<StationServicesUnregisterResponse>(
      "station.services.unregister",
      request,
    );
  }
}
