export class Persistence {
  constructor(readonly dir: string = Deno.makeTempDirSync()) {}

  teardown(): Promise<void> {
    return Deno.remove(this.dir, { recursive: true });
  }
}
