export type NodeStorage = {
  storage: string;
  type: string;
  avail?: number;
  total?: number;
  used?: number;
  active?: number;
  enabled?: number;
  shared?: number;
  content?: string;
};
