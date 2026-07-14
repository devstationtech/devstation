import type { RawService } from "@server/station/application/queries/services/all/types/raw-service.ts";

/**
 * Raw shape of a station record in `stations.json`. Mirrors the
 * persistence adapter's `StationData`. Read-side only.
 */
export type RawStation = {
  id: string;
  version: number;
  name: string;
  description: string;
  status: string;
  creation: { by: string; hostname: string; at: string };
  services: RawService[];
};
