export class Protocol {
  static readonly VERSION = "1.0";

  static handshake(core: string): { protocol: typeof Protocol.VERSION; core: string } {
    return { protocol: Protocol.VERSION, core };
  }
}
