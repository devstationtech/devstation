#!/usr/bin/env bash
set -euo pipefail

# A fresh VM runs apt from cloud-init/apt-daily at boot; wait instead of
# racing it for the apt locks (DPkg::Lock::Timeout misses the lists lock).
cloud-init status --wait >/dev/null 2>&1 || true

sudo apt-get -o DPkg::Lock::Timeout=600 update -y
sudo apt-get -o DPkg::Lock::Timeout=600 install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get -o DPkg::Lock::Timeout=600 update -y
sudo apt-get -o DPkg::Lock::Timeout=600 install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
