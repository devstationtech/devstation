/**
 * Defense-in-depth assertion for the serialized write path. A cluster
 * mutation is persisted through a serialized critical section
 * (`Clusters.update`) that reloads the aggregate fresh under the lock,
 * so in a single process the version always matches. This is raised
 * only if a write reached persistence with a base version that no
 * longer matches what is stored — i.e. a writer bypassed the serialized
 * path or another process touched the file. A loud failure instead of a
 * silent lost update.
 */
export class StaleClusterVersion extends Error {
  constructor(clusterId: string, base: number, persisted: number) {
    super(
      `stale cluster '${clusterId}': loaded version ${base} but persisted is ${persisted} — concurrent write detected.`,
    );
  }
}
