import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { InstanceRecord } from "@server/station/application/queries/instances/all/types/instance-record.ts";
import type { RawCluster } from "@server/station/application/queries/instances/all/types/raw-cluster.ts";
import type { RawService } from "@server/station/application/queries/instances/all/types/raw-service.ts";

const CLUSTERS_FILE = "clusters.json";
const STATIONS_FILE = "stations.json";

type RawStationWithServices = {
  services?: RawService[];
};

/**
 * Lists all VMs across every connected provider/cluster/node, annotated with
 * `busy`/`busyBy` derived from the Service domain. Used by the
 * register-service form to pick instances per role.
 */
export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<InstanceRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const stations = await this.fs.readObjectsOf<RawStationWithServices>(STATIONS_FILE);
    const services = stations.flatMap((s) => s.services ?? []);

    const busyByHost = new Map<
      string,
      { serviceId: string; serviceName: string; role: string }
    >();
    for (const service of services) {
      for (const instance of service.instances) {
        if (!busyByHost.has(instance.host)) {
          busyByHost.set(instance.host, {
            serviceId: service.id,
            serviceName: service.name,
            role: instance.role,
          });
        }
      }
    }

    const records: InstanceRecord[] = [];
    for (const cluster of clusters) {
      for (const node of cluster.nodes) {
        const imagesById = new Map((node.images ?? []).map((i) => [i.imageId, i]));
        for (const vm of node.virtualMachines) {
          const image = imagesById.get(vm.image);
          const busyBy = busyByHost.get(vm.address) ?? null;
          records.push({
            id: `${cluster.provider}:${cluster.id}:${vm.id}`,
            name: vm.name,
            host: vm.address,
            os: image?.os ?? "",
            provider: cluster.provider,
            cluster: { id: cluster.id, name: cluster.name },
            node: { id: node.id, name: node.name },
            specs: {
              cpu: vm.resources.cpu,
              ram: vm.resources.ram,
              disk: vm.resources.disk,
            },
            credentialVaultId: vm.credentialVaultId,
            usernameSecretId: vm.usernameSecretId,
            passwordSecretId: vm.passwordSecretId,
            busy: busyBy !== null,
            busyBy,
          });
        }
      }
    }
    return records;
  }
}
