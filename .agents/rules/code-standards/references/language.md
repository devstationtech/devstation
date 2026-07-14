# Ubiquitous Language

The verbs and terms below are domain language. Use them exactly; do not swap
synonyms in code, contracts, UI labels, docs, or commit messages. The verbs
are NOT interchangeable — pick by meaning:

## Verb families

| Verb | Meaning | Used by |
|---|---|---|
| `register` / `unregister` | **Declare/catalog** something that may already exist or is a desired-state declaration; touches no infra | cluster, node, virtual machine, image, station, service, size |
| `create` / `delete` | An entity the CLI itself **brings into existence and owns** | vault |
| `generate` | Produce a derived value (paired with `delete` for removal) | secret, token |
| `assign` / `unassign` | Declare a binding between two resources | image → node template |
| Materialization actions | Not CRUD — keep their domain names | `images.create` (materialize a template on a node), provisioning `plan`/`apply`/`destroy`, station `deploy`/`destroy`, service `install`/`uninstall` |

- Aggregates' static factories and mutating methods use these verbs
  (`Station.register`, `Vault.create`, `generateSecret`).
- Outbound **repository ports keep generic vocabulary** (`add`, `remove`,
  `update`, `of`, `byName`, `exists`) — persistence language, deliberately
  distinct from the use-case verbs above.
- When adding a new context/operation, classify it under one of the families —
  don't introduce `remove` for a register-family undo or a create-family
  delete.

## UI rule

Screen label = the backend verb; shortcut key = the verb's initial
(`r` register, `u` unregister, `c` create, `d` delete, `g` generate). The same
operation uses the same key on every screen.

## Terminology

- **"provisioning", never "terraform".** The brand word "terraform" does not
  appear in domain, application, UI, contracts, or docs — the concept is
  *provisioning* and the bundled tool is *OpenTofu*. Keep tool-native
  **file-format names** as-is (`.tf`, `*.auto.tfvars.json`,
  `terraform.tfstate`) — they are the tool's wire format, not branding.
- **"blueprint"** is the recipe (data); **"service"** is a blueprint installed
  on a station's VMs. Don't call a blueprint a service or vice versa.
- **"station"** is the workstation aggregate that owns VMs and services;
  **"cluster"** is provider infrastructure. Keep them distinct in prose.
