/**
 * Typed accessor for non-secret values supplied by the service when it
 * registered against a stack. Step authors call `ctx.inputs.string("port")`,
 * etc; the runtime throws if the type doesn't match.
 */
export interface Inputs {
  string(name: string): string;
  number(name: string): number;
  boolean(name: string): boolean;
}
