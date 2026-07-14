output "vmid" {
  description = "Proxmox VM ID"
  value       = proxmox_virtual_environment_vm.vm.vm_id
}

output "name" {
  description = "VM hostname"
  value       = proxmox_virtual_environment_vm.vm.name
}

output "ip" {
  description = "VM IP address"
  value       = var.ip
}

output "password" {
  description = "VM user password"
  value       = var.password
  sensitive   = true
}
