export {
  compareSemver,
  currentTarget,
  type TargetLabel,
  Version,
} from "@ui/self-update/version.ts";
export {
  type Asset,
  DEFAULT_MANIFEST_URL,
  fetchManifest,
  type Manifest,
  manifestUrl,
  parseManifest,
} from "@ui/self-update/manifest.ts";
export { checkForUpdate, type UpdateStatus } from "@ui/self-update/update-check.ts";
export {
  BinaryInstaller,
  type InstallOutcome,
  type InstallPhase,
  type RollbackOutcome,
} from "@ui/self-update/installer/installer.ts";
export { createInstaller } from "@ui/self-update/installer/factory.ts";
export { applyStagedUpdate } from "@ui/self-update/boot-applier.ts";
