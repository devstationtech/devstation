/**
 * Where a published value comes from once the step's shell finishes.
 *
 * - `file`: cat the remote file and use its contents.
 * - `stdoutLine`: scan captured stdout for the first line starting with
 *   `prefix=`; the value is everything after the `=`.
 */
export type PublishSource =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "stdoutLine"; readonly prefix: string };
