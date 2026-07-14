terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.78"
    }
  }
}

resource "proxmox_virtual_environment_vm" "vm" {
  name      = var.hostname
  node_name = var.target_node
  vm_id     = var.vmid
  tags      = var.tags

  clone {
    vm_id = var.template_id
    # Clone mode is resolved per target storage by DevStation
    # (CoW → linked/false; non-CoW or unknown → full/true), with a
    # per-connection override. Default true = full (universal); linked
    # is opt-in via auto-detect/override.
    full = var.full
  }

  scsi_hardware = "virtio-scsi-single"

  cpu {
    cores   = var.cores
    sockets = 1
    type    = "x86-64-v2-AES"
  }

  memory {
    dedicated = var.memory
    floating  = var.balloon_memory
  }

  disk {
    datastore_id = var.storage
    size         = var.disk_size
    interface    = "scsi0"
    iothread     = true
    file_format  = "raw"
  }

  network_device {
    bridge   = var.bridge
    firewall = true
    model    = "virtio"
  }

  initialization {
    datastore_id        = var.storage
    vendor_data_file_id = "local:snippets/cloud-init-user.yml"

    ip_config {
      ipv4 {
        address = "${var.ip}/24"
        gateway = var.gateway
      }
    }

    dns {
      servers = [var.dns]
    }

    user_account {
      username = var.user
      password = var.password
      keys     = var.ssh_public_keys
    }
  }

  # Agent is not required for our flow — we discover IPs via the static
  # ip_config above, not via the QEMU guest agent. Keeping it disabled
  # eliminates OpenTofu's "waiting for QEMU agent" timeout (5min default)
  # which dominates apply time when the agent is not yet installed inside the
  # VM. Blueprints can install qemu-guest-agent later via SSH if needed.
  agent {
    enabled = false
  }

  vga {
    type = "std"
  }

  serial_device {}

  started         = var.start_on_create
  on_boot         = true
  stop_on_destroy = true
  boot_order      = ["scsi0"]

  lifecycle {
    ignore_changes = [
      initialization[0].user_account[0].password,
      # On clone-created VMs the bpg/proxmox provider reads boot_order
      # back empty (inherits the template's, never reconciles with the
      # value above), producing a perpetual "~ boot_order = [ + scsi0 ]"
      # in-place diff on every plan — the topology never converges to "no
      # changes". boot_order above still applies it correctly at create
      # time; we only ignore the noisy post-create read-back so plan is
      # idempotent.
      boot_order,
    ]
  }
}
