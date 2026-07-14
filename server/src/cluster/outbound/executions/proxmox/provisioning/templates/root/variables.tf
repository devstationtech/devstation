variable "proxmox_host" {
  description = "Proxmox API endpoint host (no scheme or port)"
  type        = string
}

variable "proxmox_user" {
  description = "Proxmox user (e.g., root@pam)"
  type        = string
  sensitive   = true
}

variable "proxmox_password" {
  description = "Proxmox user password"
  type        = string
  sensitive   = true
}

variable "proxmox_node" {
  description = "Proxmox node name (target_node)"
  type        = string
}

variable "vms" {
  description = "Map of VMs to provision, keyed by hostname"
  type = map(object({
    vmid            = number
    template_id     = number
    ip              = string
    gateway         = string
    dns             = string
    storage         = string
    cores           = number
    memory          = number
    disk            = number
    full            = bool
    tags            = list(string)
    start_on_create = bool
    user            = string
    password        = string
  }))
}

variable "ssh_public_keys" {
  description = "SSH public keys to inject into all VMs"
  type        = list(string)
  default     = []
}
