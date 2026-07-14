export class CreateVault {
  constructor(
    readonly name: string,
    readonly user: string,
    readonly hostname: string,
  ) {}
}
