/**
 * How many instances a role accepts when registering a service.
 *
 * - `one`: exactly 1 VM (e.g. k3s.server, mysql.primary).
 * - `many`: 1 or more VMs — REQUIRED (e.g. mysql.replica, where 0 replicas
 *   would defeat the purpose).
 * - `zeroOrMore`: 0..N VMs — OPTIONAL (e.g. k3s.agent on a single-node
 *   cluster where the server also runs the embedded kubelet).
 *
 * Before `zeroOrMore` existed, k3s.agent was declared `many`, which the
 * engine validated as "≥1 instance required." Single-node homelab installs
 * (1 VM, server runs everything) couldn't register the service at all.
 * Splitting `many` (required) from `zeroOrMore` (optional) keeps the
 * contract for blueprints that genuinely need ≥1 worker while unblocking
 * the common case.
 *
 * Special cases that need a hard minimum (mongo replica-set ≥ 3, etcd quorum
 * with odd count) are validated by the blueprint's first apply step. The DSL
 * intentionally stays minimal.
 */
export type Instances = "one" | "many" | "zeroOrMore";
