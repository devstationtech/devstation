import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
import { Result as VerifyResult } from "@server/blueprint/contracts/step/verify/result.ts";
import type { Verify } from "@server/blueprint/domain/models/step/verify.ts";
import { renderShell } from "@server/station/outbound/installer/proxmox/runner/render-shell.ts";

/**
 * Runs a step's verify probe. Retries up to `verify.retryCount` times,
 * sleeping `retryIntervalSeconds` between attempts. Returns healthy on the
 * first successful run; unhealthy with the last captured stderr/stdout
 * otherwise.
 */
export async function runVerify(
  { verify, ctx }: { verify: Verify; ctx: StepContext },
): Promise<VerifyResult> {
  let lastFailure = "";

  for (let attempt = 0; attempt < verify.retryCount; attempt++) {
    if (attempt > 0) await sleep(verify.retryIntervalSeconds * 1000);

    const shell = await renderShell({ body: verify.shell, env: {}, ctx });
    const result = await ctx.ssh.run(shell);

    if (result.exitCode === 0) return VerifyResult.healthy();
    lastFailure = result.stderr || result.stdout || `exit ${result.exitCode}`;
  }
  return VerifyResult.unhealthy(lastFailure);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
