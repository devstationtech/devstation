terraform {
  required_version = ">= 1.5"

  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.78"
    }
  }

  # State path is injected at runtime via: terraform init -backend-config="path=..."
  # Expected path: ~/.devstation/v2/config/clusters/<cluster>/terraform/<node>/<env>/terraform.tfstate
  backend "local" {}
}

provider "proxmox" {
  endpoint = "https://${var.proxmox_host}:8006/"
  username = var.proxmox_user
  password = var.proxmox_password
  insecure = true
}

module "vm" {
  source   = "../modules/vm"
  for_each = var.vms

  hostname    = each.key
  vmid        = each.value.vmid
  target_node = var.proxmox_node
  template_id = each.value.template_id

  cores     = each.value.cores
  memory    = each.value.memory
  disk_size = each.value.disk

  storage = each.value.storage
  full    = each.value.full

  ip      = each.value.ip
  gateway = each.value.gateway
  dns     = each.value.dns

  user            = each.value.user
  password        = each.value.password
  ssh_public_keys = var.ssh_public_keys
  tags            = each.value.tags
  start_on_create = each.value.start_on_create
}
