/**
 * Read/write access to stack-level secrets within a install run. `get` resolves
 * a secret declared at register time (vault refs → plaintext, in-memory only).
 * `put` publishes a value during the run so it ends up on `InstallResult.secrets`
 * and gets persisted by the vault listener after the install finishes.
 */
export interface Secrets {
  put(name: string, value: string): Promise<void>;
  get(name: string): Promise<string>;
}
