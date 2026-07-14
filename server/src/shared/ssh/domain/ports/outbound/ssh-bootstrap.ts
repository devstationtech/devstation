/**
 * One-shot password-authenticated SSH used to install the DevStation
 * automation public key on a remote host. After this runs successfully,
 * every subsequent SSH op against the host goes through `SshCli`
 * (key-only — no sshpass, no password in flight).
 *
 * Why a separate port: the automation path is key-based and lives in
 * `SshCli`. Bootstrap is the bridge from "remote has only password
 * auth set up" to "remote accepts our key". It uses a different
 * library under the hood (an in-process SSH client; we don't want to
 * bring `sshpass` back via subprocess) and runs at most once per host.
 *
 * Guarantees the adapter must keep:
 *   - never read or modify private keys (no touch on `~/.ssh/id_*`);
 *   - never overwrite `authorized_keys` blindly — append-only on
 *     regular filesystems, chmod-write-chmod on Proxmox pmxcfs
 *     (read-only FUSE) where append is structurally impossible;
 *   - idempotent: detect the key already present, return without write;
 *   - backup `authorized_keys` (timestamped) before any modification;
 *   - after installing, verify the install by reconnecting with the
 *     key; the bootstrap fails (rolled back where possible) if
 *     post-install auth doesn't work.
 */
export interface SshBootstrap {
  installKey(request: SshBootstrapRequest): Promise<SshBootstrapResult>;
}

export type SshBootstrapRequest = {
  readonly host: string;
  readonly port?: number;
  readonly user: string;
  readonly password: string;
  /** Public key content in OpenSSH single-line form, e.g. `ssh-ed25519 AAAA... comment`. */
  readonly publicKey: string;
};

export type SshBootstrapResult = {
  /** True when the public key now reaches `authorized_keys` on the remote. */
  readonly installed: boolean;
  /** True when the key was already in `authorized_keys` (we wrote nothing). */
  readonly alreadyPresent: boolean;
  /** True when `authorized_keys` is a symlink into Proxmox pmxcfs (/etc/pve/priv/). */
  readonly pmxcfsDetected: boolean;
  /**
   * True when pmxcfs rejected the direct write and the adapter fell back
   * to breaking the symlink: `~/.ssh/authorized_keys` becomes a regular
   * file (initial contents = pmxcfs file + our key) and sshd reads from
   * that local file from then on. The cluster-wide /etc/pve/priv/authorized_keys
   * is untouched — DevStation gains key access without affecting the
   * cluster's own peer authentication.
   */
  readonly symlinkBroken?: boolean;
  /** Backup file written before the modification; absent when alreadyPresent. */
  readonly backupPath?: string;
};

export class SshBootstrapFailed extends Error {
  constructor(message: string, readonly reason?: unknown) {
    super(message);
    this.name = "SshBootstrapFailed";
  }
}
