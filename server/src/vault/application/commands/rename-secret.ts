export class RenameSecret {
  constructor(
    readonly vaultId: string,
    readonly secretId: string,
    readonly name: string,
  ) {}
}
