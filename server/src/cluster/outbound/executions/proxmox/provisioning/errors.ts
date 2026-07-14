/**
 * Raised when the engine cannot find the bundled provisioning runtime.
 *
 * The bundled distribution ships the runtime binary as a sidecar next
 * to the wrapper, and the wrapper exports `DEVSTATION_SIDECAR_DIR`
 * before spawning the engine. If neither the operator override nor the
 * sidecar resolves, the install is broken — there is no PATH fallback
 * by design (zero-setup is the contract).
 */
export class ProvisioningRuntimeNotInstalled extends Error {
  constructor(searched: string[]) {
    super(
      "Provisioning runtime not found. The bundled runtime should ship " +
        "alongside the DevStation binary. Searched: " + searched.join(", ") +
        ". If you extracted the archive partially, re-extract; if you set " +
        "$DEVSTATION_PROVISIONING_BINARY, make sure it points at a valid " +
        "executable. Re-download the latest release from " +
        "https://github.com/devstationtech/devstation/releases.",
    );
  }
}

export class ProvisioningExecutionFailed extends Error {
  constructor(action: string, stderr: string) {
    super(`provisioning ${action} failed: ${stderr}`);
  }
}

export class ProvisioningPlanParseFailed extends Error {
  constructor(reason: string) {
    super(`failed to parse provisioning plan: ${reason}`);
  }
}
