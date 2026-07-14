import type { SshCli, Target } from "@server/shared/ssh/outbound/cli.ts";

const MAX_ATTEMPTS = 90;
const INTERVAL_MS = 4_000;
const CONNECTION_REFUSED = "Connection refused";

/**
 * Blocks until sshd accepts connections on the target. Yields a status string
 * each retry cycle so the caller can stream progress.
 *
 * The total wait window (~6 min) is tuned for freshly-booted cloud images
 * running first-boot init (apt update + qemu-guest-agent install + sshd
 * reload), which routinely takes 3-10 minutes before the first remote command
 * can succeed. Shorter waits would race against init on a cold VM.
 */
export async function* waitForSshReady(
  ssh: SshCli,
  target: Target,
  signal: AbortSignal,
): AsyncGenerator<string, void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) throw new Error("aborted");

    let exitCode = 0;
    let stdout = "";
    let stderr = "";
    for await (const event of ssh.run(target, "true", signal)) {
      if (event.type === "done") {
        exitCode = event.code;
        stdout = event.stdout;
        stderr = event.stderr;
      }
    }

    const refused = stdout.includes(CONNECTION_REFUSED) ||
      stderr.includes(CONNECTION_REFUSED);
    if (!refused && exitCode === 0) return;
    if (!refused) return;

    if (attempt < MAX_ATTEMPTS) {
      const elapsedSeconds = Math.round((attempt * INTERVAL_MS) / 1000);
      yield `waiting for sshd on ${target.host} (${elapsedSeconds}s elapsed)`;
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  throw new Error(
    `sshd on ${target.host} never became reachable after ${
      Math.round((MAX_ATTEMPTS * INTERVAL_MS) / 1000)
    }s.`,
  );
}
