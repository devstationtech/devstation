import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import { Station } from "@server/station/domain/models/station.ts";
import { Id } from "@server/station/domain/models/id.ts";
import { Name } from "@server/station/domain/models/name.ts";
import { Description } from "@server/station/domain/models/description.ts";
import { Service } from "@server/station/domain/models/service/service.ts";
import { Id as ServiceId } from "@server/station/domain/models/service/id.ts";
import { Name as ServiceName } from "@server/station/domain/models/service/name.ts";
import { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Inputs, type InputValue } from "@server/station/domain/models/service/inputs.ts";
import { Instance } from "@server/station/domain/models/service/instance.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Role as ServiceRole } from "@server/station/domain/models/service/role.ts";
import { Host } from "@server/station/domain/models/service/host.ts";
import { Installation } from "@server/station/domain/models/service/installation.ts";
import { InstallResult } from "@server/station/domain/models/service/install-result.ts";
import type { Status as ServiceStatus } from "@server/station/domain/models/service/status.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

const FILENAME = "stations.json";

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

type HostData = {
  serviceId: string;
  role: string;
};

type ServiceData = {
  id: string;
  name: string;
  blueprint: string;
  vaultId: string;
  inputs: Record<string, InputValue>;
  secrets: Record<string, string>;
  instances: InstanceData[];
  host: HostData | null;
  status: string;
  failureReason?: string | null;
  installations: InstallationData[];
  creation: { by: string; hostname: string; at: string };
};

type StationData = {
  id: string;
  version: number;
  name: string;
  description: string;
  creation: { by: string; hostname: string; at: string };
  services: ServiceData[];
};

export class Adapter implements Stations {
  // Serialize writes to the shared stations.json (same pattern as the
  // Clusters adapter). Needed once Server.serve() dispatches mutating
  // requests concurrently: without this, two read-modify-write writes
  // would interleave/tear the file. NOTE: this prevents file corruption,
  // not the install stale-overwrite (load-once then save across a long
  // run) — that requires an `update`-style load-inside-lock with
  // one-document-per-aggregate persistence.
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly fs: FileSystem) {}

  private serialize<T>(critical: () => Promise<T>): Promise<T> {
    const result = this.writeChain.then(critical, critical);
    this.writeChain = result.then(() => {}, () => {});
    return result;
  }

  async of(id: Id): Promise<Station> {
    const all = await this.readAll();
    const data = all.find((s) => s.id === id.value);
    if (!data) throw new StationNotFound();
    return this.deserialize(data);
  }

  async byName(name: Name): Promise<Station | null> {
    const all = await this.readAll();
    const data = all.find((s) => s.name === name.value);
    return data ? this.deserialize(data) : null;
  }

  add(station: Station): Promise<void> {
    return this.serialize(async () => {
      const all = await this.readAll();
      if (all.some((s) => s.id === station.id.value)) {
        throw new Error(`station ${station.id.value} already exists.`);
      }
      all.push(this.toData(station));
      await this.write(all);
    });
  }

  save(station: Station): Promise<void> {
    return this.serialize(async () => {
      const all = await this.readAll();
      const index = all.findIndex((s) => s.id === station.id.value);
      if (index === -1) throw new StationNotFound();
      all[index] = this.toData(station);
      await this.write(all);
    });
  }

  update(id: Id, change: (station: Station) => void): Promise<Station> {
    return this.serialize(async () => {
      const all = await this.readAll();
      const index = all.findIndex((s) => s.id === id.value);
      if (index === -1) throw new StationNotFound();
      const station = this.deserialize(all[index]);
      change(station);
      all[index] = this.toData(station);
      await this.write(all);
      return station;
    });
  }

  remove(id: Id): Promise<void> {
    return this.serialize(async () => {
      const all = await this.readAll();
      const filtered = all.filter((s) => s.id !== id.value);
      if (filtered.length === all.length) throw new StationNotFound();
      await this.write(filtered);
    });
  }

  private readAll(): Promise<StationData[]> {
    return this.fs.readObjectsOf<StationData>(FILENAME);
  }

  private write(stations: StationData[]): Promise<void> {
    return this.fs.writeObjectsOf(FILENAME, stations);
  }

  private toData(station: Station): StationData {
    return {
      id: station.id.value,
      version: station.version.value,
      name: station.name.value,
      description: station.description.value,
      creation: {
        by: station.creation.by.value,
        hostname: station.creation.hostname.value,
        at: station.creation.at.toString(),
      },
      services: station.services.map((service) => this.serializeService(service)),
    };
  }

  private serializeService(service: Service): ServiceData {
    return {
      id: service.id.value,
      name: service.name.value,
      blueprint: service.blueprint.value,
      vaultId: service.vault.value,
      inputs: service.inputs.toRecord(),
      secrets: Object.fromEntries(
        Object.entries(service.secrets.toRecord()).map(([k, v]) => [k, v.value]),
      ),
      instances: service.instances.map((i) => ({
        role: i.role.name,
        host: i.host,
        credential: {
          vaultId: i.credential.vault.value,
          username: i.credential.username.value,
          password: i.credential.password.value,
        },
      })),
      host: service.host
        ? { serviceId: service.host.service.value, role: service.host.role }
        : null,
      status: service.status,
      failureReason: service.failureReason,
      installations: service.installations.map((d) => ({
        role: d.role.name,
        host: d.host,
        result: {
          blueprint: { version: d.result.blueprint.version },
          // Never write secret values to disk — the vault is their only
          // durable home. The aggregate already sanitizes on install;
          // this keeps the guarantee even if a caller forgets.
          secrets: {},
          outputs: { ...d.result.outputs },
        },
        at: d.at.toString(),
      })),
      creation: {
        by: service.creation.by.value,
        hostname: service.creation.hostname.value,
        at: service.creation.at.toString(),
      },
    };
  }

  private deserialize(data: StationData): Station {
    return new Station(
      new Id(data.id),
      new Name(data.name),
      new Description(data.description),
      new Creation(
        new User(data.creation.by),
        new Hostname(data.creation.hostname),
        Instant.fromString(data.creation.at),
      ),
      (data.services ?? []).map((s) => this.deserializeService(s)),
      new Version(data.version),
    );
  }

  private deserializeService(data: ServiceData): Service {
    const secrets = new Secrets(
      Object.fromEntries(Object.entries(data.secrets).map(([k, v]) => [k, new Secret(v)])),
    );
    const instances = data.instances.map((i) =>
      new Instance(
        new ServiceRole(i.role),
        i.host,
        new Credential(
          new Vault(i.credential.vaultId),
          new Secret(i.credential.username),
          new Secret(i.credential.password),
        ),
      )
    );
    // `deployments` is the legacy key (renamed to `installations`); read both
    // so state written before the deploy->install rename still loads.
    const rawInstallations = data.installations ??
      (data as { deployments?: InstallationData[] }).deployments ?? [];
    const installations = rawInstallations.map((d) =>
      new Installation(
        new ServiceRole(d.role),
        d.host,
        new InstallResult(
          { version: d.result.blueprint.version },
          // Secret values never re-enter the domain from disk.
          // The vault holds them; any stale on-disk secrets self-heal on
          // the next save because the loaded aggregate carries none.
          {},
          { ...d.result.outputs },
        ),
        Instant.fromString(d.at),
      )
    );
    const host = data.host ? new Host(new ServiceId(data.host.serviceId), data.host.role) : null;
    return new Service(
      new ServiceId(data.id),
      new ServiceName(data.name),
      new BlueprintName(data.blueprint),
      new Vault(data.vaultId),
      new Inputs(data.inputs),
      secrets,
      instances,
      host,
      new Creation(
        new User(data.creation.by),
        new Hostname(data.creation.hostname),
        Instant.fromString(data.creation.at),
      ),
      // Legacy status values predate the deploy->install rename.
      (({
        DEPLOYING: "INSTALLING",
        DEPLOYED: "INSTALLED",
        DESTROYING: "UNINSTALLING",
        DESTROYED: "UNINSTALLED",
        DESTROY_FAILED: "UNINSTALL_FAILED",
      } as Record<string, string>)[
        data.status
      ] ?? data.status) as ServiceStatus,
      installations,
      data.failureReason ?? null,
    );
  }
}
