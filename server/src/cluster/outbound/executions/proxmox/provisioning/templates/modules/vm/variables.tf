variable "hostname" {
  description = "VM hostname"
  type        = string
}

variable "vmid" {
  description = "Proxmox VM ID"
  type        = number
}

variable "target_node" {
  description = "Proxmox node name"
  type        = string
}

variable "template_id" {
  description = "VM ID of the cloud-init template to clone"
  type        = number
}

variable "cores" {
  description = "Number of CPU cores"
  type        = number
}

variable "memory" {
  description = "Dedicated memory in MB"
  type        = number
}

variable "balloon_memory" {
  description = "Maximum balloon memory in MB (0 = disabled)"
  type        = number
  default     = 0
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
}

variable "full" {
  description = "Full clone (true) vs linked/CoW clone (false). Resolved per target storage by DevStation."
  type        = bool
  default     = true
}

variable "storage" {
  description = "Proxmox storage pool for disks"
  type        = string
}

variable "bridge" {
  description = "Network bridge"
  type        = string
  default     = "vmbr0"
}

variable "ip" {
  description = "Static IP address (without CIDR)"
  type        = string
}

variable "gateway" {
  description = "Network gateway"
  type        = string
}

variable "dns" {
  description = "DNS server"
  type        = string
}

variable "user" {
  description = "Default user to create via cloud-init"
  type        = string
  default     = "devstation"
}

variable "password" {
  description = "Password for the default user"
  type        = string
  sensitive   = true
}

variable "ssh_public_keys" {
  description = "List of SSH public keys to inject"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags for the VM"
  type        = list(string)
  default     = []
}

variable "start_on_create" {
  description = "Start VM after creation"
  type        = bool
  default     = true
}
