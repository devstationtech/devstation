/** Untrusted shape of `blueprint.yaml` after YAML decoding, before validation. */
export type RawBlueprint = {
  name?: unknown;
  description?: unknown;
  version?: unknown;
  compatibility?: { os?: unknown };
  placement?: unknown;
  inputs?: unknown;
  roles?: unknown;
  host?: { blueprint?: unknown; role?: unknown };
  install?: unknown;
  uninstall?: unknown;
};
