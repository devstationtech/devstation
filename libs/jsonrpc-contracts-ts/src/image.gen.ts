// AUTO-GENERATED from @jsonrpc-schemas/image.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

export class ImageRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly os: string,
    readonly sourceUrl: string,
    readonly version: number,
    readonly usages: ReadonlyArray<ImageUsage>,
  ) {}
}

/** A cluster/node template where the catalog image is in use. */
export class ImageUsage {
  constructor(
    readonly clusterId: string,
    readonly clusterName: string,
    readonly nodeId: string,
    readonly nodeName: string,
  ) {}
}

export type Ack = Record<string, unknown>;

/** Request payload for `image.register`. */
export interface ImageRegisterRequest {
  readonly sessionId: string;
  readonly name: string;
  readonly os: "ubuntu-22-04" | "ubuntu-24-04" | "debian-12" | "debian-13";
  readonly sourceUrl: string;
  readonly user: string;
  readonly hostname: string;
}

/** Response payload of `image.register`. */
export type ImageRegisterResponse = Ack;

/** Request payload for `image.update`. */
export interface ImageUpdateRequest {
  readonly sessionId: string;
  readonly id: string;
  readonly name: string;
  readonly os: "ubuntu-22-04" | "ubuntu-24-04" | "debian-12" | "debian-13";
  readonly sourceUrl: string;
}

/** Response payload of `image.update`. */
export type ImageUpdateResponse = Ack;

/** Request payload for `image.unregister`. */
export interface ImageUnregisterRequest {
  readonly sessionId: string;
  readonly id: string;
}

/** Response payload of `image.unregister`. */
export type ImageUnregisterResponse = Ack;

/** Request payload for `image.list`. */
export interface ImageListRequest {
  readonly sessionId: string;
}

/** Response payload of `image.list`. */
export type ImageListResponse = ReadonlyArray<ImageRecord>;
