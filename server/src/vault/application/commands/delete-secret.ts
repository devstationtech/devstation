export class DeleteSecret {
  constructor(
    readonly vaultId: string,
    readonly secretId: string,
  ) {}
}
