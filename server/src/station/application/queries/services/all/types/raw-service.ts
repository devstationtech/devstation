/**
 * Raw shape of a service nested inside a station record in `stations.json`.
 * Mirrors the persistence adapter's `ServiceData`. Read-side only —
 * write-side uses the Station aggregate.
 *
 * Note: services are nested under `stations[].services[]`. This type does
 * NOT carry `stationId`; readers attach it from the parent station when
 * flattening.
 */
export type RawService = {
  id: string;
  name: string;
  blueprint: string;
  vaultId: string;
  inputs: Record<string, string | number | boolean>;
  secrets: Record<string, string>;
  instances: Array<{
    role: string;
    host: string;
    credential: { vaultId: string; username: string; password: string };
  }>;
  /** Hosted services point at a host service+role; null for standalone services. */
  host: { serviceId: string; role: string } | null;
  status: string;
  failureReason?: string | null;
  installations: Array<{
    role: string;
    host: string;
    result: {
      blueprint: { version: string };
      secrets: Record<string, string>;
      outputs: Record<string, string>;
    };
    at: string;
  }>;
  creation: { by: string; hostname: string; at: string };
};
