/** One distinct VM tag and how many VMs (across all clusters) use it. */
export type TagUsageRecord = {
  tag: string;
  count: number;
};
