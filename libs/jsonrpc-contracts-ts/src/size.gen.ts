// AUTO-GENERATED from @jsonrpc-schemas/size.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

/** Size summary for listing. cpu/ram/disk are present for Proxmox; absent for providers that don't model them. */
export class SizeRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly provider: string,
    readonly version: number,
    readonly cpu?: number,
    readonly ram?: number,
    readonly disk?: number,
  ) {}
}

export type Ack = Record<string, unknown>;

/** Request payload for `size.register`. */
export interface SizeRegisterRequest {
  readonly sessionId: string;
  readonly name: string;
  readonly provider: string;
  readonly cpu: number;
  readonly ram: number;
  readonly disk: number;
  readonly user: string;
  readonly hostname: string;
}

/** Response payload of `size.register`. */
export type SizeRegisterResponse = Ack;

/** Request payload for `size.unregister`. */
export interface SizeUnregisterRequest {
  readonly sessionId: string;
  readonly sizeId: string;
}

/** Response payload of `size.unregister`. */
export type SizeUnregisterResponse = Ack;

/** Request payload for `size.list`. */
export interface SizeListRequest {
  readonly sessionId: string;
}

/** Response payload of `size.list`. */
export type SizeListResponse = ReadonlyArray<SizeRecord>;
