export type RawStation = {
  id: string;
  version: number;
  name: string;
  description: string;
  creation: { by: string; hostname: string; at: string };
  /** Services nested under this station. Status is derived from these. */
  services: Array<{ id: string; status: string }>;
};
