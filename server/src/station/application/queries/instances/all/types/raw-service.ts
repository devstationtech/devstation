/**
 * Subset of the service write-side shape consulted by the instance/all query
 * to compute `busy`. Reading the Service domain directly (not the cluster's
 * `vm.services` projection) keeps the invariant where it belongs.
 */
export type RawService = {
  id: string;
  name: string;
  instances: Array<{ role: string; host: string }>;
};
