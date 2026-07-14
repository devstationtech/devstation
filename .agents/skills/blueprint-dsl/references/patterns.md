# Reference: Catalog Patterns (copy the closest sibling)

The five shipped blueprints cover every shape. Find the row matching your case,
open that `blueprint.yaml`, and adapt it — don't start from a blank file. (More
elaborate, environment-specific recipes — a reverse-proxy with wildcard-cert
automation, a DBaaS control plane, per-route proxy entries — belong in a user's
own `~/devstation/blueprints`, not the shipped catalog.)

## Standalone

| Pattern | Copy from | Demonstrates |
|---|---|---|
| Single role, package install | `blueprints/docker/blueprint.yaml` | One `main` role; `script: scripts/install.sh` sidecar; `verify` with `command -v` / `systemctl is-enabled`; per-role `uninstall` with a `! command -v` guard. |
| Multi-role peer handoff | `blueprints/k3s/blueprint.yaml` | `server` (`instances: one`) + `agent` (`instances: zeroOrMore`); `publish.secret` of the node token; agent reads `${peer.server.host}` / `${peer.server.secrets.k3sToken}`; `verify.retry`; per-role `uninstall` running the uninstall scripts. |

Notes:

- `instances`: `one` (default) | `many` (1..N, required) | `zeroOrMore` (0..N).
  k3s.agent is `zeroOrMore` so a single-node cluster is valid.
- The sidecar shell lives in `blueprints/docker/scripts/install.sh` — reference it
  with `script: scripts/install.sh`.

## Hosted

| Pattern | Copy from | Demonstrates |
|---|---|---|
| Apply upstream manifests + teardown | `blueprints/argocd/blueprint.yaml` | `host: { blueprint: k3s, role: server }`; idempotent namespace + `kubectl apply --server-side` + `rollout status`; per-step `verify`; top-level `uninstall` deleting the manifest with `--ignore-not-found` / `|| true`. |
| Compose stack via `${file:}` | `blueprints/jenkins/blueprint.yaml` | Ships two `${file:}` sidecars — `docker-compose.yaml` (the stack) and `security.groovy` (the `init.groovy.d` admin bootstrap) — each inlined inside a single-quoted heredoc; hosted on `portainer.main`; renders `$VAR` env with `envsubst`. |
| Minimal hosted service | `blueprints/portainer/blueprint.yaml` | Smallest hosted shape; a good skeleton to start from. |

## Idioms worth copying verbatim

- **Idempotent k8s apply:** `kubectl create ns X --dry-run=client -o yaml |
  kubectl apply -f -`, then `verify: kubectl get ns X >/dev/null 2>&1`.
- **Inline a sidecar safely:**
  ```yaml
  run: |
    sudo k3s kubectl apply -n ns -f - <<'OPERATOR_EOF'
    ${file:operator.yaml}
    OPERATOR_EOF
  ```
  The single-quoted `'OPERATOR_EOF'` stops the shell from re-expanding the
  inlined content; `${file:...}` is resolved by the parser before the shell runs.
- **Tolerant destroy:** `kubectl delete ... --ignore-not-found=true 2>/dev/null
  || true`, or `if [ -f /usr/local/bin/x-uninstall.sh ]; then ... fi`.
- **Async convergence:** `verify.retry: { count: 30, intervalSeconds: 3 }` for
  daemons and rollouts.

For the meaning of any key used above, see
[`docs/blueprint-dsl.md`](../../../../docs/blueprint-dsl.md).
