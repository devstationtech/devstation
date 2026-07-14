/**
 * How a blueprint occupies its host (VM for standalone, host service for hosted).
 *
 * - `exclusive`: at most one service of this blueprint may run on a given
 *   host. Default; safer for resource-heavy blueprints (k3s, mysql, docker).
 * - `shared`: multiple services of this (or other) blueprints may coexist on
 *   the same host. Suited for sidecar-like blueprints (agents, exporters).
 *
 * Enforced by the register-service handler against the Service write-side.
 */
export type Placement = "exclusive" | "shared";
