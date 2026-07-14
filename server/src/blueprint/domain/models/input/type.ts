/**
 * Discrete kinds of inputs a blueprint can declare.
 *
 * A cross-service reference type (`blueprint-ref`) was reserved here but never
 * consumed by the engine or UI, so it's been dropped from the public v1 DSL
 * rather than ship a no-op. It returns when the referencing feature is built.
 */
export enum Type {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  SECRET = "SECRET",
}
