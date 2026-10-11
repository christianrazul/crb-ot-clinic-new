#!/usr/bin/env bash
# One-time (and safe to re-run) preparation of an Ubuntu server for the stack:
# updates, automatic security updates, Docker from Docker's apt repository,
# firewall, swap, a `deploy` user for CI, and /srv/crb-ot-clinic.
#
#   sudo DEPLOY_PUBKEY="ssh-ed25519 AAAA... github-actions deploy" bash setup-server.sh
#
# Password logins over SSH are turned off only when HARDEN_SSH=1 and root
# already has a working key, so this can never lock you out.
set -euo pipefail

: "${DEPLOY_PUBKEY:?set DEPLOY_PUBKEY to the CI public key}"
APP_DIR=/srv/crb-ot-clinic
export DEBIAN_FRONTEND=noninteractive

echo "== Packages and automatic security updates"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl gnupg ufw unattended-upgrades fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Docker (official apt repository)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "== Firewall: SSH, HTTP, HTTPS (and HTTP/3)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "== Swap (2 GB, if there is none)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== deploy user for CI (key only, can run Docker)"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
grep -qxF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys || echo "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "== App directory"
install -d -m 750 -o deploy -g deploy "$APP_DIR"

if [ "${HARDEN_SSH:-0}" = 1 ]; then
  if [ -s /root/.ssh/authorized_keys ]; then
    echo "== SSH: keys only"
    cat > /etc/ssh/sshd_config.d/10-crb-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
    sshd -t
    systemctl reload ssh
  else
    echo "!! Skipped SSH hardening: root has no authorized key yet." >&2
  fi
fi

echo "== Done"
docker --version
docker compose version
ufw status | head -8
