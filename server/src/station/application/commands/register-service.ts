import { Id as StationDomainId } from "@server/station/domain/models/id.ts";
import type { InputValue } from "@server/station/domain/models/service/inputs.ts";

export type InstanceData = {
  readonly role: string;
  readonly host: string;
  readonly credentialVaultId: string;
  readonly usernameSecretId: string;
  readonly passwordSecretId: string;
};

export type HostData = {
  readonly serviceId: string;
  readonly role: string;
};

/**
 * Application-layer command for registering a service inside a station.
 * Handler is responsible for translating primitives into VOs.
 */
export class RegisterService {
  constructor(
    readonly stationId: string,
    readonly name: string,
    readonly blueprint: string,
    readonly vaultId: string,
    readonly inputs: Record<string, InputValue>,
    readonly secrets: Record<string, string>,
    readonly user: string,
    readonly hostname: string,
    readonly instances: InstanceData[] | null,
    readonly host: HostData | null,
  ) {
    const hasInstances = instances !== null && instances.length > 0;
    const hasHost = host !== null;
    if (hasInstances && hasHost) {
      throw new Error(
        "RegisterService: provide either instances (standalone) or host (hosted), not both.",
      );
    }
    if (!hasInstances && !hasHost) {
      throw new Error(
        "RegisterService: provide either instances (standalone) or host (hosted).",
      );
    }
  }

  stationDomainId(): StationDomainId {
    return new StationDomainId(this.stationId);
  }
}
