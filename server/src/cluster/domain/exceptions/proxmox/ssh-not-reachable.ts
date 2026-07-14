export class SshNotReachable extends Error {
  constructor(host: string, reason: string) {
    super(`ssh to '${host}' failed: ${reason}.`);
  }
}
