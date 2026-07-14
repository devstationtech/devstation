# Blueprint YAML DSL

A blueprint is a declarative recipe for installing and operating a service on
one or more instances. It lives at `<name>/blueprint.yaml`, alongside optional
sidecar shell scripts (`scripts/`) and asset files referenced via `${file:...}`.

DevStation reads every directory under the catalog roots, parses the YAML, and
exposes the catalog to the operator at register time.

### Where blueprints are read from (official + your own)

The catalog layers two roots:

1. the **bundled** blueprints shipped with DevStation (`BLUEPRINTS_PATH`), and
2. your **user-local** blueprints at `~/.devstation/blueprints/<name>/blueprint.yaml`
   (override with `USER_BLUEPRINTS_PATH`).

You do **not** need to contribute to the project to add your own — just drop a
`<name>/blueprint.yaml` under `~/.devstation/blueprints`. Both roots are merged;
if a user blueprint has the **same name** as a bundled one, **yours wins**. The
blueprints screen marks each entry's `source` as `local` or `official`.

The easy way to install one is the CLI, which validates it with the real parser
and copies it into place:

```
devstation blueprint register ./my-blueprint            # a directory…
devstation blueprint register ./my-blueprint/blueprint.yaml   # …or the file
devstation blueprint register ./docker --force          # override a same-name one
```

It refuses to shadow an existing blueprint (official or local) unless `--force`
is given, and reports validation errors up front.

---

## File layout

```
blueprints/
└── k3s/
    ├── blueprint.yaml        # required
    ├── scripts/              # optional — referenced by `step.script`
    │   └── install.sh
    └── operator.yaml         # optional — inlined via ${file:operator.yaml}
```

A JSON Schema (draft 2020-12) is published at
`https://raw.githubusercontent.com/devstationtech/devstation/main/blueprints/blueprint.v1.schema.json` (source:
`blueprints/blueprint.v1.schema.json`). Start each `blueprint.yaml` with the
modeline so editors validate + autocomplete against it:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/devstationtech/devstation/main/blueprints/blueprint.v1.schema.json
name: k3s
...
```

The schema is enforced, not decorative: `devstation blueprint register` runs a
structural schema check before the parser (rejecting unknown/typo'd fields the
parser would ignore), and CI validates the whole catalog against it. The
hand-written parser remains the semantic source of truth (roles-XOR-host,
`${file:}` resolution, domain invariants).

---

## Top-level fields

| Field           | Required | Description                                                                      |
| --------------- | :------: | -------------------------------------------------------------------------------- |
| `name`          |    ✓     | Unique kebab-case identifier. Must match the directory name.                     |
| `description`   |    ✓     | One-line summary shown in the catalog.                                           |
| `version`       |    ✓     | Semver of the blueprint itself (independent from the software it installs).      |
| `compatibility` |    ✓     | `{ os: [...] }` — supported OSes, drawn from `ubuntu-22-04`, `ubuntu-24-04`, `debian-12`, `debian-13`. |
| `placement`     |          | `exclusive` (default) or `shared`. Whether two services of this blueprint may co-exist on the same host. |
| `inputs`        |          | List of values the operator must supply at register time (see below).            |
| `roles`         |    ◯     | Standalone form: declares the roles this blueprint runs as. **Mutex with `host`.**     |
| `host`          |    ◯     | Hosted form: identifies the standalone blueprint+role this runs on top of. **Mutex with `roles`.** |
| `install`         |    ◯     | Top-level steps (hosted form only — required when `host` is set).               |
| `uninstall`       |          | Top-level teardown steps (hosted form). Standalone blueprints declare `uninstall` per role instead. |

✓ = always required · ◯ = required in exactly one of the two shapes (below).

A blueprint is one of two shapes:

- **Standalone** — declares `roles[]`. Each role has its own steps and runs on its own VMs.
  Examples: `docker`, `k3s`.
- **Hosted** — declares `host: { blueprint, role }` plus top-level `install[]`.
  Brings no VMs of its own; runs on the VMs of a host service.
  Examples: `argocd` hosted on `k3s.server`, `portainer` hosted on `docker.main`.

---

## `inputs[]`

Values supplied by the operator at register time.

```yaml
inputs:
  - name: portainer-api-key
    label: "Portainer API Key"
    type: secret
    required: true
    help: "Generated from Portainer UI > Settings > API tokens."
  - name: port
    label: "HTTP port"
    type: number
    default: 8080
```

| Field      | Required | Description                                                                |
| ---------- | :------: | -------------------------------------------------------------------------- |
| `name`     |    ✓     | Identifier used in `${inputs.X}` and `${secrets.X}` templates.             |
| `label`    |    ✓     | Human label shown in the form.                                             |
| `type`     |    ✓     | `string` \| `number` \| `boolean` \| `secret`           |
| `required` |          | Default `false`.                                                           |
| `default`  |          | Value pre-filled in the form. Reserve for non-secret types.                |
| `help`     |          | Hint shown under the field.                                                |

Secrets are stored in the operator's vault; they reach the runtime via
`${secrets.X}` (resolved through the vault adapter at install time).

---

## `roles[]` (standalone form)

```yaml
roles:
  - name: server
    instances: one    # "one" | "many" | "zeroOrMore"; default "one"
    install:
      - name: install
        description: Install K3s server
        run: curl -sfL https://get.k3s.io | sudo sh -
    uninstall:
      - name: uninstall
        description: Remove K3s server
        run: sudo /usr/local/bin/k3s-uninstall.sh
```

| Field       | Required | Description                                                              |
| ----------- | :------: | ------------------------------------------------------------------------ |
| `name`      |    ✓     | Identifier used in `${peer.<role>...}` from other roles.                 |
| `instances` |          | `one` (default), `many` (1..N, required), or `zeroOrMore` (0..N, optional). The picker enforces this at register time. |
| `install`     |    ✓     | Ordered list of work units (see below). At least one.                    |
| `uninstall`   |          | Ordered teardown steps, run in reverse role order when the service is uninstalled. Same step shape as `install`. |

The installer iterates `roles[]` in declared order and within each role iterates
the operator-supplied instances. Subsequent roles read previous-role peers via
`${peer.<role>...}`.

---

## `host` (hosted form)

```yaml
host:
  blueprint: k3s
  role: server

install:
  - name: install
    description: install argocd
    run: kubectl apply -f manifest.yaml
```

| Field       | Required | Description                                                |
| ----------- | :------: | ---------------------------------------------------------- |
| `blueprint` |    ✓     | Standalone blueprint whose role this hosted blueprint runs on top of. |
| `role`      |    ✓     | Role within that blueprint.                                           |

The hosted blueprint's `install[]` steps execute on the VMs of the chosen host service's role.

---

## `install[]`

Each step is a unit of work the installer runs against one host (a VM, for
standalone blueprints; a host service's instance, for hosted blueprints).

```yaml
- name: install
  description: Install Docker CE and start the daemon
  script: scripts/install.sh
  env:
    DOCKER_VERSION: "24.0.7"
  verify:
    run: command -v docker
    retry: { count: 5, intervalSeconds: 2 }
  publish:
    secret:
      registryToken: "file:/etc/docker/registry.token"
    fact:
      version: "stdout-line:DOCKER_VERSION="
  rollback:
    run: sudo apt-get remove -y docker-ce
```

| Field         | Required | Description                                                                       |
| ------------- | :------: | --------------------------------------------------------------------------------- |
| `name`        |    ✓     | Identifier shown in install logs.                                                  |
| `description` |    ✓     | One-line explanation surfaced in the UI.                                          |
| `run`         |    ◯     | Inline shell. **Mutex with `script`.**                                            |
| `script`      |    ◯     | Path to a sibling `.sh` file (e.g. `scripts/install.sh`). **Mutex with `run`.**   |
| `env`         |          | Map of `KEY: value` pairs exported before the shell runs. Values support templating. |
| `verify`      |          | Health probe: skips the step when already-healthy. Supports retry.                |
| `publish`     |          | Capture published secrets and facts after the step succeeds.                      |
| `rollback`    |          | Inline shell or `script:` path executed when the step's shell fails.              |

### How a step executes

For each host, steps run in declared order. One step goes through:

1. **Probe** — if `verify` is declared and exits 0, the step is already healthy
   and is skipped entirely.
2. **Apply** — `run` / `script` executes with `env` exported and `${...}`
   templates resolved; on success, `publish` values are captured.
3. **Confirm** — `verify` runs again (honoring `retry`); the step only counts as
   done once the probe passes.

If the apply fails (non-zero shell, or a `publish` read error), `rollback` runs
best-effort and the install stops. A failed confirm also stops the install, but
does **not** trigger `rollback`.

### `verify`

```yaml
verify:
  run: systemctl is-active k3s
  retry:
    count: 30
    intervalSeconds: 3
```

Exits 0 → healthy. Exits non-zero → unhealthy. The same probe serves twice:
before the apply (healthy → step skipped, which is what keeps steps idempotent)
and after it (the step only succeeds once the probe passes). With `retry`, the
installer re-runs `verify.run` until either it passes or `count` attempts are
exhausted — use it for things that converge asynchronously, like a daemon
coming up or a rollout finishing.

### `publish`

```yaml
publish:
  secret:
    k3sToken: "file:/var/lib/rancher/k3s/server/node-token"
  fact:
    apiUrl: "stdout-line:KUBE_APISERVER="
```

After the step's shell finishes successfully, the installer captures one value
per declared key. Two source forms:

- `file:/remote/path` — runs `sudo cat /remote/path` and uses the contents.
- `stdout-line:PREFIX=` — scans the captured stdout for the first line starting
  with `PREFIX=`; the value is everything after `=`.

`secret` values are persisted to the service's vault and exposed to peer
hosted blueprints via `${peer.<role>.secrets.X}`. `fact` values land in
`InstallResult.outputs` (UI-visible, not secret).

### `rollback`

```yaml
rollback:
  run: sudo /usr/local/bin/k3s-uninstall.sh
```

Runs best-effort when the step's shell (or a `publish` read) fails — not when
its post-apply `verify` fails. Same shape as `run` / `script`. Add it wherever a
partial apply can leave debris behind.

---

## `uninstall[]`

Teardown steps run when an installed service is uninstalled (not when a single
step fails during install — that's `rollback`). Each entry has the same shape as a
`install[]` entry (`run` / `script`, `verify`, `env`, templating).

- **Standalone** — declared per role (`roles[].uninstall`). Roles tear down in
  reverse declaration order, so dependents go before their dependencies.
- **Hosted** — declared at the top level (`uninstall`), alongside `install`.

```yaml
roles:
  - name: server
    install: [...]
    uninstall:
      - name: uninstall
        description: Remove K3s server
        run: |
          if [ -f /usr/local/bin/k3s-uninstall.sh ]; then
            sudo /usr/local/bin/k3s-uninstall.sh
          fi
        verify:
          run: "! systemctl is-active k3s >/dev/null 2>&1"
```

---

## Templating in shell strings

Any string in `run`, `script` (the file content), `env.*`, `verify.run`, and
`rollback.run` may contain `${...}` placeholders. They are resolved per host:

| Placeholder                          | Description                                                              |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `${inputs.X}`                        | Value of input `X` (non-secret).                                         |
| `${secrets.X}`                       | Value of secret `X` (resolved from the vault).                           |
| `${role}`                            | Name of the current role.                                                |
| `${host}`                            | Host the step is running on (IP or hostname).                            |
| `${peer.<role>.host}`                | Sugar for the first peer of `<role>`.                                    |
| `${peer.<role>[N].host}`             | Host of the N-th peer of `<role>`.                                       |
| `${peer.<role>[N].secrets.X}`        | Secret `X` published by that peer.                                       |
| `${peer.<role>[N].outputs.X}`        | Fact `X` published by that peer.                                         |
| `${file:path}`                       | Inlined contents of a sibling file (resolved at parse time).             |

Unknown placeholders fail loudly at install time (`${secrets.X}` is resolved before
shell execution, not via shell substitution). Use single-quoted heredocs to
embed inlined files without further shell interpolation:

```yaml
run: |
  cat <<'EOF' | sudo k3s kubectl apply -f -
  ${file:operator.yaml}
  EOF
```

---

## Examples

### Standalone blueprint with a single role

```yaml
name: docker
description: Container runtime (Docker CE) with compose plugin
version: 1.0.0
compatibility:
  os: [ubuntu-22-04, debian-12]

roles:
  - name: main
    install:
      - name: install
        description: Install Docker CE
        script: scripts/install.sh
        verify: { run: command -v docker }
      - name: enable
        description: Enable and start the daemon
        run: sudo systemctl enable --now docker
        verify: { run: systemctl is-enabled docker }
```

### Standalone blueprint with peer handoff (k3s)

```yaml
name: k3s
description: K3s lightweight Kubernetes cluster (server + agents)
version: 1.0.0
compatibility:
  os: [ubuntu-22-04, debian-12]

roles:
  - name: server
    instances: one
    install:
      - name: install
        description: Install K3s server
        run: curl -sfL https://get.k3s.io | sudo sh -
        verify:
          run: systemctl is-active k3s
          retry: { count: 30, intervalSeconds: 3 }
      - name: publish-token
        description: Make the cluster token available to agents
        run: sudo test -r /var/lib/rancher/k3s/server/node-token
        publish:
          secret:
            k3sToken: "file:/var/lib/rancher/k3s/server/node-token"

  - name: agent
    instances: zeroOrMore
    install:
      - name: install
        description: Join the K3s cluster
        env:
          K3S_URL: "https://${peer.server.host}:6443"
          K3S_TOKEN: "${peer.server.secrets.k3sToken}"
        run: curl -sfL https://get.k3s.io | sudo -E sh -
        verify:
          run: systemctl is-active k3s
          retry: { count: 30, intervalSeconds: 3 }
```

### Hosted blueprint (argocd on k3s)

```yaml
name: argocd
description: GitOps continuous delivery for Kubernetes
version: 1.0.0
compatibility:
  os: [ubuntu-22-04, debian-12]

host:
  blueprint: k3s
  role: server

install:
  - name: namespace
    description: Create the argocd namespace (idempotent)
    run: |
      sudo k3s kubectl create namespace argocd --dry-run=client -o yaml | sudo k3s kubectl apply -f -
    verify:
      run: sudo k3s kubectl get namespace argocd >/dev/null 2>&1

  - name: install
    description: Apply ArgoCD upstream manifests
    run: |
      sudo k3s kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
      sudo k3s kubectl rollout status -n argocd deployment/argocd-server --timeout=180s
    verify:
      run: sudo k3s kubectl get deployment -n argocd argocd-server >/dev/null 2>&1
```

---

## Validation rules (parser)

The parser fails fast on:

- Missing required top-level fields.
- A blueprint with neither `roles` nor `host`.
- A blueprint with both `roles` and `host`.
- A hosted blueprint with no `install`, or a standalone with `install` outside its roles.
- Duplicate role names.
- A step with both `run` and `script`, or with neither.
- Unknown input `type`, `instances` value, or `placement` value.
- A `publish.{secret|fact}.X` whose value doesn't start with `file:` or `stdout-line:`.

Errors include the offending path (`<blueprint>.roles[1].install[2].verify.run`) so
authors can locate the problem without reading the whole tree.
