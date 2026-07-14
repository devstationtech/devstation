# Topology model

DevStation describes infrastructure as a **topology** — a single declarative
model split into two layers. You describe what exists once; the tool
provisions it and installs onto it.

## Infrastructure layer — where things run

```
Cluster (homelab-platform)            Cluster (homelab-apps)
  └─ Provider: proxmox                  └─ Provider: proxmox
       └─ Node: cp1                          └─ Node: cp2
            ├─ VM: k3s-server                     ├─ VM: k3s-server
            ├─ VM: k3s-agent                      └─ VM: k3s-agent
            ├─ VM: database
            └─ VM: tools
```

- **Cluster** — a named group of machines under one provider. The provider
  (Proxmox today) owns the connection and the provisioning runtime.
- **Node** — a physical/hypervisor host within the cluster.
- **Virtual Machine** — a guest provisioned on a node from a size
  (CPU/RAM/disk) and an image, carrying free-form `tags`.

Provisioning (`plan` / `apply` / `destroy`) operates on this layer via the
bundled IaC runtime (OpenTofu).

## Logical layer — what runs on top

```
Station (homelab)
  ├─ Service: docker ── Service: portainer        (hosted on docker)
  ├─ Service: k3s-platform
  ├─ Service: k3s-apps
  ├─ Service: percona-everest
  ├─ Service: jenkins
  ├─ Service: infisical
  └─ Service: nginx-proxy
```

- **Station** — a logical environment grouping the services installed across
  one or more clusters' VMs.
- **Service** — a unit installed from a **blueprint** onto VM instances. A
  service can be *standalone* (its own instances) or *hosted* on another
  service's role (e.g. `portainer` on `docker`). Installs run the blueprint's
  steps over SSH; published secrets land in the vault.

The two layers stay decoupled: the infrastructure layer knows nothing about
services, and the logical layer references VMs only by the instances an
install targets.
