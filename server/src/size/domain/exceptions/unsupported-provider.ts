export class UnsupportedProvider extends Error {
  constructor(provider: string) {
    super(`unsupported provider: ${provider}`);
  }
}
