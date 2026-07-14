export class GenerateSecret {
  constructor(
    readonly vaultId: string,
    readonly name: string,
    readonly key: string,
    readonly hostname: string,
    readonly user: string,
    readonly value: string | null,
    readonly description: string | null,
    /** When true, replace any existing secret with the same name. Default false. */
    readonly replaceIfExists: boolean = false,
  ) {}
}
