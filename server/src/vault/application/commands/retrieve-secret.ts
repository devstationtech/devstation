export class RetrieveSecret {
  constructor(
    readonly vaultId: string,
    readonly secretId: string,
    readonly key: string,
  ) {}
}
