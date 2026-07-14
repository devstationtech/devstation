output "vms" {
  description = "Provisioned VMs with their credentials"
  value = {
    for name, vm in module.vm : name => {
      vmid     = vm.vmid
      name     = vm.name
      ip       = vm.ip
      password = vm.password
    }
  }
  sensitive = true
}
