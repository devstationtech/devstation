import { dirname, join } from "node:path";
import { copy } from "@std/fs";
import type { RootTfvars } from "@server/cluster/outbound/executions/proxmox/provisioning/tfvars.ts";

const TFVARS_FILENAME = "vms.auto.tfvars.json";

export class WorkingDir {
  constructor(
    private readonly imagesRoot: string,
    private readonly baseDir: string,
  ) {}

  async prepare(
    clusterName: string,
    nodeName: string,
    tfvars: RootTfvars,
  ): Promise<string> {
    const dir = this.pathFor(clusterName, nodeName);
    await Deno.mkdir(dir, { recursive: true, mode: 0o700 });
    await Deno.chmod(dir, 0o700);
    await this.syncModules(dir);
    await this.writeTfvars(dir, tfvars);
    return dir;
  }

  // One provisioning workspace per node.
  pathFor(clusterName: string, nodeName: string): string {
    return join(this.baseDir, "clusters", clusterName, "provisioning", nodeName);
  }

  stateFile(clusterName: string, nodeName: string): string {
    return join(this.pathFor(clusterName, nodeName), "terraform.tfstate");
  }

  /**
   * Removes the generated tfvars file. Called after a provisioning run so the
   * per-VM cloud-init credentials it carries do not linger in cleartext — the
   * durable copy lives in the encrypted state. Regenerated on the next run.
   * Best-effort: a missing file is not an error.
   */
  async discardTfvars(clusterName: string, nodeName: string): Promise<void> {
    const path = join(this.pathFor(clusterName, nodeName), "root", TFVARS_FILENAME);
    try {
      await Deno.remove(path);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }

  private async syncModules(targetDir: string): Promise<void> {
    const targetRootModule = join(targetDir, "root");
    const targetModules = join(targetDir, "modules");
    await this.reset(targetRootModule);
    await this.reset(targetModules);
    await copy(join(this.imagesRoot, "root"), targetRootModule);
    await copy(join(this.imagesRoot, "modules"), targetModules);
  }

  private async reset(path: string): Promise<void> {
    try {
      await Deno.remove(path, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }

  private async writeTfvars(dir: string, tfvars: RootTfvars): Promise<void> {
    const path = join(dir, "root", TFVARS_FILENAME);
    const parentDir = dirname(path);
    await Deno.mkdir(parentDir, { recursive: true, mode: 0o700 });
    await Deno.writeTextFile(path, JSON.stringify(tfvars, null, 2) + "\n");
    await Deno.chmod(path, 0o600);
  }
}
