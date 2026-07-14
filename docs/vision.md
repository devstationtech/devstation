# Vision

DevStation is an open-source engineering cockpit. Today it does one thing —
**Topologies** — and it is built to grow into more without changing what is
already there.

## The problem

There is a gap between having hardware and having useful infrastructure. A
homelab means choosing a hypervisor, learning its UI, writing IaC or clicking
through screens, preparing each machine over SSH, and documenting it all — then
repeating everything when something breaks. The result is usually idle hardware,
or an artisanal setup nobody can rebuild.

## Who it's for

Homelabbers and self-hosters first — and, more broadly, software engineers and
students who run personal projects, PoCs and study environments on their own
hardware in their spare time. You should not need to be an infrastructure
specialist to get a reproducible environment; if you already are one, DevStation
stays out of your way and shows you everything it does.

## What DevStation does

Topologies closes that gap with one declarative model:

- **One model** describes the whole environment.
- **Provisioning** generates and runs the OpenTofu configuration for you — no
  prior IaC knowledge required.
- **Service install** over SSH from declarative blueprints.
- **Reproducibility** — the same topology rebuilds the same environment, any time.

DevStation does not replace Proxmox, OpenTofu, or Docker. It is the layer above
them: the topology is the source of truth; provisioning and install are its
consequences.

## Principles

- **Easy to understand, easy to use.** Guided and opinionated — no buzzwords, no
  memorizing commands. Deeper control is there when you want it.
- **Open from the start.** Open source is the foundation, not a future decision.
- **Multi-provider by design.** Proxmox today; the same model targets others
  without a rewrite.
- **Never opaque.** You can always inspect the generated configuration, the
  state, and the commands being run.

## What it is not

Not a cloud, not a Proxmox or OpenTofu replacement, not a corporate platform, and
not DevOps-experience-required. Everything runs on your hardware, and you stay in
control.
