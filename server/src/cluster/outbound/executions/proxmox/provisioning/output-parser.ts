const APPLY_PATTERN =
  /Apply complete!\s+ProxmoxResources:\s+(\d+)\s+added,\s+(\d+)\s+changed,\s+(\d+)\s+destroyed/;
const DESTROY_PATTERN = /Destroy complete!\s+ProxmoxResources:\s+(\d+)\s+destroyed/;

export type ApplyStats = {
  created: number;
  updated: number;
  deleted: number;
};

export type DestroyStats = {
  deleted: number;
};

export function parseApplyStats(output: string): ApplyStats {
  const match = output.match(APPLY_PATTERN);
  if (!match) return { created: 0, updated: 0, deleted: 0 };
  return {
    created: Number(match[1]),
    updated: Number(match[2]),
    deleted: Number(match[3]),
  };
}

export function parseDestroyStats(output: string): DestroyStats {
  const match = output.match(DESTROY_PATTERN);
  if (!match) return { deleted: 0 };
  return { deleted: Number(match[1]) };
}
