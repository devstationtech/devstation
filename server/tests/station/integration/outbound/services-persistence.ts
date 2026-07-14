import { readFile } from "node:fs/promises";
import { join } from "node:path";

type InstanceData = {
  role: string;
  host: string;
  credential: { vaultId: string; username: string; password: string };
};

type InstallationData = {
  role: string;
  host: string;
  result: {
    blueprint: { version: string };
    secrets: Record<string, string>;
    outputs: Record<string, string>;
  };
  at: string;
};

export type ServiceRecord = {
  id: string;
  name: string;
  blueprint: string;
  vaultId: string;
  inputs: Record<string, string | number | boolean>;
  secrets: Record<string, string>;
  instances: InstanceData[];
  host: { serviceId: string; role: string } | null;
  status: string;
  installations: InstallationData[];
  creation: { by: string; hostname: string; at: string };
};

export type StationRecord = {
  id: string;
  version: number;
  name: string;
  description: string;
  status: string;
  creation: { by: string; hostname: string; at: string };
  services: ServiceRecord[];
};

const FILENAME = "stations.json";

/**
 * Read-only test helper that inspects the consolidated `stations.json`.
 * Tests mutate state via the action under test, then assert via this helper.
 * Services live nested under stations in the consolidated stations.json.
 */
export class Persistence {
  constructor(readonly dir: string = Deno.makeTempDirSync()) {}

  teardown(): Promise<void> {
    return Deno.remove(this.dir, { recursive: true });
  }

  async readStations(): Promise<StationRecord[]> {
    try {
      const raw = await readFile(join(this.dir, FILENAME), "utf-8");
      return JSON.parse(raw) as StationRecord[];
    } catch {
      return [];
    }
  }

  /** All services across all stations, flattened. Each carries `stationId`. */
  async readAll(): Promise<(ServiceRecord & { stationId: string })[]> {
    const stations = await this.readStations();
    return stations.flatMap((station) =>
      (station.services ?? []).map((s) => ({ ...s, stationId: station.id }))
    );
  }

  async readByName(name: string): Promise<ServiceRecord & { stationId: string }> {
    const all = await this.readAll();
    const record = all.find((s) => s.name === name);
    if (!record) throw new Error(`service '${name}' not found.`);
    return record;
  }
}
