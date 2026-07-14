export type StationRecord = {
  id: string;
  name: string;
  description: string;
  status: string;
  /** Total services registered to this station. */
  serviceCount: number;
  /** Per-status counts derived from the station's services. */
  serviceStats: {
    registered: number;
    installing: number;
    installed: number;
    failed: number;
    aborted: number;
  };
};
