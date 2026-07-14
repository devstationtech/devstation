import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { Succeeded } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Failed } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Cancelled } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Step } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Images } from "@server/cluster/domain/ports/outbound/executions/proxmox/images/images.ts";
import type { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import type { Node } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import type { CredentialResolver } from "@server/cluster/outbound/credential-resolver.ts";
import type { SshCli, Target } from "@server/shared/ssh/outbound/cli.ts";
import type { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";
import {
  LOG_LATENCY_MS,
  LOG_LINES,
  LogTimeBuffer,
} from "@server/shared/executions/outbound/streaming/log-time-buffer.ts";
import { emitFrom } from "@server/shared/executions/outbound/streaming/emit-from.ts";

// Proxmox host paths — canonical Proxmox layout for VM disk and snippet storage.
const PROXMOX_QEMU_DIR = "/var/lib/vz/template/qemu";
const SNIPPET_DIR = "/var/lib/vz/snippets";
const CLOUD_INIT_FILE = "cloud-init-user.yml";
const SNIPPETS_STORAGE = "local";
// Path of the cloud-init snippet relative to PROVISIONING_TEMPLATES_PATH.
const CLOUD_INIT_SOURCE = `cloud-init/${CLOUD_INIT_FILE}`;

/**
 * Cloud-image download as a streamable, newline-delimited progress
 * command. `curl -fsSL` is silent (no progress meter), and curl's bar
 * is `\r`-based so it never streams line-by-line over SSH. Instead we
 * download in the background and poll the file size against the
 * HEAD `Content-Length` every few seconds, emitting one `\n`-terminated
 * line per tick that `execStep` forwards as a Log event. Cached image
 * still short-circuits (with a line, so the step is never silent), and
 * `wait $pid` propagates curl's exit code so a failed download fails
 * the step.
 */
export function downloadCloudImageCmd(imagePath: string, imageUrl: string): string {
  return [
    `if [ -f ${imagePath} ]; then echo "cloud image already cached"; else`,
    `sz=$(curl -fsSL -I ${imageUrl} 2>/dev/null`,
    `| awk 'tolower($0) ~ /content-length/ {print $2}' | tr -d "\\r" | tail -n1);`,
    `curl -fL -o ${imagePath} ${imageUrl} & pid=$!;`,
    `while kill -0 $pid 2>/dev/null; do`,
    `cur=$(stat -c%s ${imagePath} 2>/dev/null || echo 0);`,
    `if [ -n "$sz" ] && [ "$sz" -gt 0 ] 2>/dev/null;`,
    `then echo "download: $cur/$sz bytes ($((cur*100/sz))%)";`,
    `else echo "download: $cur bytes"; fi;`,
    `sleep 3; done; wait $pid; fi`,
  ].join(" ");
}

export class ImagesAdapter implements Images {
  constructor(
    private readonly ssh: SshCli,
    private readonly identity: IdentityProvider,
    private readonly credentials: CredentialResolver,
    private readonly templatesFs: FileSystem,
  ) {}

  create(node: Node, assigned: NodeImage): Task {
    return {
      run: (execution, emitter) => emitFrom(this.runCreate(node, assigned, execution), emitter),
    };
  }

  private async *runCreate(
    node: Node,
    assigned: NodeImage,
    execution: Execution,
  ): AsyncIterable<ExecutionEvent> {
    const target = await this.resolveTarget(node);
    const cloudInitContent = await this.templatesFs.read(CLOUD_INIT_SOURCE);
    const snippetPath = `${SNIPPET_DIR}/${CLOUD_INIT_FILE}`;

    // Always refresh the cloud-init snippet on the proxmox host before
    // anything else — even when the VM image already exists. If we
    // skipped this, edits to cloud-init-user.yml would never reach the
    // proxmox host (because `qm template` was already done) and newly
    // installed VMs would still pick up the stale snippet.
    yield new Step("refresh cloud-init snippet on host");
    const snippetContent = cloudInitContent.endsWith("\n")
      ? cloudInitContent
      : cloudInitContent + "\n";
    const refreshOk = yield* this.execStep(
      target,
      "refresh cloud-init snippet",
      `mkdir -p ${SNIPPET_DIR} && cat > ${snippetPath} <<'CLOUD_INIT_EOF'\n${snippetContent}CLOUD_INIT_EOF`,
      execution.signal,
      node.name.value,
    );
    if (!refreshOk) return;

    // Skip if VM already exists (treated as a template)
    if (
      await this.alreadyExistsAsTemplate(target, assigned.virtualMachineId.value, execution.signal)
    ) {
      yield new Log(
        `✓ image ${assigned.name.value} already exists on ${node.name.value} — skipping creation (snippet refreshed)`,
      );
      yield new Succeeded({});
      return;
    }

    const virtualMachineId = assigned.virtualMachineId.value;
    const storage = assigned.storage.value;
    const imageUrl = assigned.source.url.value;
    const imageName = this.imageNameFromUrl(imageUrl);
    const imagePath = `${PROXMOX_QEMU_DIR}/${imageName}`;

    const steps: Array<{ label: string; cmd: string }> = [
      { label: `ensure dirs exist`, cmd: `mkdir -p ${PROXMOX_QEMU_DIR} ${SNIPPET_DIR}` },
      {
        label: `download cloud image (skip if cached)`,
        cmd: downloadCloudImageCmd(imagePath, imageUrl),
      },
      {
        label: `create vm ${virtualMachineId}`,
        cmd:
          `qm create ${virtualMachineId} --name ${assigned.name.value} --memory 2048 --cores 2 --net0 virtio,bridge=vmbr0 --ostype l26`,
      },
      {
        label: `import disk`,
        cmd: `qm importdisk ${virtualMachineId} ${imagePath} ${storage}`,
      },
      {
        label: `attach disk to vm`,
        cmd:
          `qm set ${virtualMachineId} --scsihw virtio-scsi-pci --scsi0 ${storage}:vm-${virtualMachineId}-disk-0`,
      },
      {
        label: `attach cloud-init drive`,
        cmd: `qm set ${virtualMachineId} --ide2 ${storage}:cloudinit`,
      },
      {
        label: `set boot order`,
        cmd: `qm set ${virtualMachineId} --boot c --bootdisk scsi0`,
      },
      {
        // `--vga std` keeps the standard graphical display visible in the
        // Proxmox web Console — essential for diagnosing cloud-init hangs.
        // `--serial0 socket` is still added so `qm terminal <vmid>` works
        // for serial output when needed.
        label: `attach console (graphical + serial)`,
        cmd: `qm set ${virtualMachineId} --serial0 socket --vga std`,
      },
      {
        label: `attach cloud-init snippet`,
        cmd:
          `qm set ${virtualMachineId} --cicustom "vendor=${SNIPPETS_STORAGE}:snippets/${CLOUD_INIT_FILE}"`,
      },
      {
        label: `convert vm ${virtualMachineId} into template`,
        cmd: `qm template ${virtualMachineId}`,
      },
    ];

    for (const { label, cmd } of steps) {
      if (execution.signal.aborted) {
        yield new Cancelled();
        return;
      }
      yield new Step(label);
      const ok = yield* this.execStep(target, label, cmd, execution.signal, node.name.value);
      if (!ok) return;
    }

    yield new Succeeded({});
  }

  private async resolveTarget(node: Node): Promise<Target> {
    // Username comes from the vault (Proxmox often stores it as e.g.
    // `root@pam` — the realm suffix is stripped for the SSH login).
    // The vault password is not consumed here; automation uses the shared
    // CLI identity at ~/.ssh/devstation_ed25519, pre-authorized via
    // `ssh-copy-id`.
    const credential = await this.credentials.resolve(
      node.credential.vault.value,
      node.credential.username.value,
      node.credential.password.value,
    );
    const sshUser = credential.user.includes("@") ? credential.user.split("@")[0] : credential.user;
    return {
      host: node.ip.value,
      user: sshUser,
      identityFile: await this.identity.ensureIdentity(),
    };
  }

  private async *execStep(
    target: Target,
    label: string,
    cmd: string,
    signal: AbortSignal,
    nodeName: string,
  ): AsyncGenerator<ExecutionEvent, boolean> {
    let code = 0;
    let stdout = "";
    let stderr = "";
    // Batch per-line SSH stdout; `finally` drains the tail on normal
    // end and on a thrown error.
    const logs = new LogTimeBuffer(LOG_LATENCY_MS, LOG_LINES);
    try {
      for await (const event of this.ssh.run(target, cmd, signal)) {
        if (event.type === "log") {
          const chunk = logs.add(event.line);
          if (chunk !== null) yield new Log(chunk);
        } else {
          code = event.code;
          stdout = event.stdout;
          stderr = event.stderr;
        }
      }
    } finally {
      const tail = logs.drain();
      if (tail !== null) yield new Log(tail);
    }
    if (code !== 0) {
      yield new Failed(
        this.shortError(
          `image step "${label}" failed on ${nodeName} (exit ${code}): ${stderr || stdout}`,
        ),
      );
      return false;
    }
    return true;
  }

  private async alreadyExistsAsTemplate(
    target: Target,
    virtualMachineId: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    let code = 0;
    let stdout = "";
    for await (const event of this.ssh.run(target, `qm status ${virtualMachineId}`, signal)) {
      if (event.type === "done") {
        code = event.code;
        stdout = event.stdout;
      }
    }
    if (code !== 0) return false;
    return stdout.includes("status:") || stdout.includes("template:");
  }

  private imageNameFromUrl(url: string): string {
    const segments = url.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "image.img";
  }

  private shortError(message: string): string {
    const first = message.split("\n").map((l) => l.trim()).find(Boolean) ?? message;
    return first.length > 200 ? first.slice(0, 197) + "..." : first;
  }
}
