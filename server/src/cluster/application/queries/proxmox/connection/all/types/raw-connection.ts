export type RawConnection = {
  host: string;
  vaultId: string;
  secretId: string;
  policy?: { cloneStrategy?: string; parallelism?: number };
};
