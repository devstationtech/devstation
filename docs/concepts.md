# Concepts

> DevStation is an open-source engineering cockpit; **Topologies** — its first capability — is what these terms describe. Each gets a one-line definition, why it matters, and an example.

---

## Topology

The topology is the map of your environment.

It describes what exists, how things are grouped, and what each machine should do. It is the single source of truth for both provisioning and installation.

See [docs/topology.md](topology.md) for the full two-layer model and ASCII diagram.

---

## Infrastructure layer

The infrastructure layer describes the physical and virtual machines that make up your environment.

### Cluster

A cluster is a named group of nodes under one provider.

**Why it matters.** You can have a Proxmox cluster at home — described by the same model, managed by the same CLI.

**Example.** `homelab-proxmox` represents a mini PC running Proxmox.

---

### Provider

A provider is the platform where infrastructure runs. The provider owns the connection credentials and the provisioning runtime.

**Why it matters.** DevStation is designed to be provider-agnostic. The topology model is the same; what changes is the adapter that talks to each provider.

**Supported today:** Proxmox.

---

### Node

A node is a physical (or hypervisor-level) host inside a cluster that runs VMs.

**Why it matters.** Nodes define capacity — CPU, RAM, storage, network — and determine where each VM lands.

**Example.** Inside `homelab-proxmox`, the node `cp4` is a mini PC with 32 GB of RAM and 1 TB of SSD.

---

### Virtual Machine

A virtual machine (VM) is a guest provisioned on a node. Each VM is created from a **Size** (CPU/RAM/disk size) and an **Image** (the base OS), and carries free-form **tags**.

**Why it matters.** The VM is where the infrastructure layer and the logical layer meet. A VM knows nothing about which service runs on it; that relationship lives in the logical layer.

**Example.** `k3s-worker-01` is a VM with size `medium`, image `ubuntu-22-04`, tags `["k3s", "homelab"]`.

---

### Size

A size specifies the compute profile of a VM: vCPUs, RAM, and disk.

**Why it matters.** Sizes let you reuse machine configurations. If `medium` means "4 vCPUs, 8 GB RAM, 80 GB disk", you never write that by hand again.

**Example.** `small` (2/4/40 GB), `medium` (4/8/80 GB), `large` (8/16/160 GB).

---

### Image

An image is a central catalog entry for a bootable OS: a name, the OS it installs, and the source URL of its cloud image. The catalog is shared across clusters.

**Why it matters.** Images separate *which operating system* from *how much machine* (the size). To use one, you assign it to a node, where DevStation materializes it as a reusable template; the node keeps a snapshot, so removing the catalog entry never strands an assigned node.

**Example.** `ubuntu-22-04`, `ubuntu-24-04`, `debian-12`, `debian-13`.

---

### Tags

Tags are free-form, optional labels attached to a VM: `k3s`, `db`, `media`, `client-a`. There is no central catalog — the CLI can surface tags already in use so you can reuse them.

**Why it matters.** Tags are lightweight and editable. They travel to Proxmox alongside the base `devstation` tag. To separate environments (dev/prod), the model is **one Station per environment**, not a separate `environment` field.

**Example.** `["k3s", "homelab"]`, `["db", "client-a"]`.

---

## Logical layer

The logical layer describes the services that run on top of the infrastructure.

### Station

A Station is a named logical environment that groups services installed across one or more clusters.

**Why it matters.** You can have a `homelab` station that spans multiple clusters and nodes, described and managed as a single unit.

**Example.** Station `homelab` contains services `docker`, `k3s-platform`, `jenkins`, and `portainer`.

---

### Blueprint

A blueprint is a declarative recipe for installing and operating a service on one or more instances. It lives in `<name>/blueprint.yaml`. The catalog merges the bundled blueprints with your own under `~/.devstation/blueprints` — a user blueprint of the same name overrides the bundled one, and the UI marks each as `local` or `official`.

A blueprint is either **standalone** (it declares its own VM roles) or **hosted** (it runs on top of another service's VMs). See [docs/blueprint-dsl.md](blueprint-dsl.md) for the full reference.

**Example.** The `k3s` blueprint declares a `server` role and an `agent` role; the `argocd` blueprint is hosted on `k3s`'s `server` role.

---

### Service

A service is a running instance of a blueprint within a Station. It is installed from a blueprint onto specific VM instances over SSH.

A service can be **standalone** — occupying its own VMs — or **hosted** on another service's role. A standalone blueprint defines named roles (e.g. `server`, `agent`, `primary`, `replica`) that are filled by VM instances at install time.

**Why it matters.** Services are the reusable, composable pieces of your environment. The same blueprint can back multiple services in different stations.

**Example.** Service `k3s-platform` is installed from the `k3s` blueprint; service `portainer-main` is hosted on `docker`'s `main` role.

---

## Provisioning

Provisioning is the step where the topology becomes real infrastructure.

DevStation generates the correct OpenTofu configuration for your topology and provider, then runs `plan` / `apply` / `destroy` through its bundled OpenTofu runtime — nothing to install separately. The `.tf` / `.tfvars` file format is an implementation detail of the engine.

**Example.** You declare three VMs; DevStation generates the corresponding configuration, runs `apply`, and creates those three VMs on Proxmox.

---

## Vault

The vault is the local credential store.

Passwords, SSH keys, API tokens, and provider credentials are stored encrypted at rest behind a master password. They never appear in plain text in topology files.

**Example.** Your Proxmox API key is stored as a secret in the vault. The topology references it by ID; the actual value is only decrypted at runtime after authentication.

---

## Reproducibility

Reproducibility is the value that ties everything together.

A disk breaks. You replace a mini PC. You want to experiment with a fresh environment. With a defined topology, all of those situations reduce to a command instead of a lost weekend.

**Example.** You hand the topology to a friend who wants a similar homelab. They adjust credentials and names; everything else comes up the same way.
