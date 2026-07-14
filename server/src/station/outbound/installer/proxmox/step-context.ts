import type {
  Inputs,
  Peer,
  RoleHandle,
  Secrets,
  Ssh,
  StepContext,
} from "@server/blueprint/index.ts";
import type { Role } from "@server/station/domain/models/service/role.ts";

/**
 * Concrete StepContext built per step by the proxmox installer. The peers map
 * is populated as roles complete: when an agent step runs, it can read peers
 * from the server role that already finished via `ctx.fromRole("server")`.
 */
export class RuntimeStepContext implements StepContext {
  readonly inputs: Inputs;
  readonly secrets: Secrets;

  constructor(
    inputValues: Readonly<Record<string, string | number | boolean>>,
    resolvedSecrets: Readonly<Record<string, string>>,
    publishedSecrets: Map<string, string>,
    publishedOutputs: Map<string, string>,
    readonly ssh: Ssh,
    readonly role: Role,
    readonly host: string,
    private readonly peersByRole: ReadonlyMap<string, readonly Peer[]>,
  ) {
    this.inputs = inputBag(inputValues);
    this.secrets = secretsAccess(resolvedSecrets, publishedSecrets, publishedOutputs);
  }

  fromRole(name: string): RoleHandle {
    const peers = this.peersByRole.get(name);
    if (!peers || peers.length === 0) {
      throw new Error(`role '${name}' is not available — not yet installed in this run.`);
    }
    return {
      first: () => peers[0],
      all: () => peers,
    };
  }
}

function inputBag(values: Readonly<Record<string, string | number | boolean>>): Inputs {
  return {
    string(name: string): string {
      const value = values[name];
      if (typeof value !== "string") throw new Error(`input '${name}' is not a string.`);
      return value;
    },
    number(name: string): number {
      const value = values[name];
      if (typeof value !== "number") throw new Error(`input '${name}' is not a number.`);
      return value;
    },
    boolean(name: string): boolean {
      const value = values[name];
      if (typeof value !== "boolean") throw new Error(`input '${name}' is not a boolean.`);
      return value;
    },
  };
}

function secretsAccess(
  resolved: Readonly<Record<string, string>>,
  published: Map<string, string>,
  _outputs: Map<string, string>,
): Secrets {
  return {
    put(name: string, value: string): Promise<void> {
      published.set(name, value);
      return Promise.resolve();
    },
    get(name: string): Promise<string> {
      if (published.has(name)) return Promise.resolve(published.get(name)!);
      if (name in resolved) return Promise.resolve(resolved[name]);
      return Promise.reject(new Error(`secret '${name}' not found.`));
    },
  };
}
