#!/usr/bin/env bash
#
# harden-vps.sh — baseline hardening for an Ubuntu/Debian VPS.
#
#   * UFW firewall: deny inbound by default, allow only 22 (SSH), 80, 443.
#   * SSH: disable password authentication (key-based auth only).
#   * fail2ban: ban hosts that brute-force SSH.
#
# Idempotent: safe to re-run. Must run as root.
#
#   sudo ./scripts/harden-vps.sh
#
# ⚠️  WARNING: this disables SSH password login. Make sure your public key is
#     already in ~/.ssh/authorized_keys for the account you use, or you may lock
#     yourself out. Set ALLOW_PASSWORD_AUTH=1 to skip that specific change.

set -euo pipefail

# ---------------------------------------------------------------- helpers ----
log()  { printf '\033[1;32m[harden]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[harden] WARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[harden] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

SSH_PORT="${SSH_PORT:-22}"
ALLOW_PASSWORD_AUTH="${ALLOW_PASSWORD_AUTH:-0}"

# ------------------------------------------------------------- preflight -----
[ "$(id -u)" -eq 0 ] || die "must be run as root (try: sudo $0)"

if ! command -v apt-get >/dev/null 2>&1; then
  die "apt-get not found — this script targets Ubuntu/Debian."
fi

export DEBIAN_FRONTEND=noninteractive

log "Updating package lists and installing ufw, fail2ban, openssh-server..."
apt-get update -y
apt-get install -y ufw fail2ban openssh-server

# ---------------------------------------------------------------- UFW --------
log "Configuring UFW firewall (allow only ${SSH_PORT}, 80, 443)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Rate-limit SSH to further slow brute-force attempts.
ufw limit "${SSH_PORT}/tcp" comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow 443/udp  comment 'HTTP/3 (QUIC)'

ufw --force enable
ufw status verbose

# ---------------------------------------------------------------- SSH --------
SSHD_DROPIN="/etc/ssh/sshd_config.d/99-orbit-hardening.conf"

if [ "${ALLOW_PASSWORD_AUTH}" = "1" ]; then
  warn "ALLOW_PASSWORD_AUTH=1 set — leaving SSH password authentication enabled."
else
  log "Disabling SSH password authentication via ${SSHD_DROPIN}..."
  mkdir -p /etc/ssh/sshd_config.d

  # Warn (do not block) if the invoking user has no authorized_keys on file.
  target_home="${SUDO_USER:+/home/${SUDO_USER}}"
  if [ -n "${target_home}" ] && [ ! -s "${target_home}/.ssh/authorized_keys" ]; then
    warn "No authorized_keys found for '${SUDO_USER}'. Ensure key-based login works before you log out!"
  fi

  cat >"${SSHD_DROPIN}" <<'EOF'
# Managed by scripts/harden-vps.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin prohibit-password
UsePAM yes
EOF

  # Validate config before reloading so a typo can't break sshd.
  if sshd -t; then
    systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || \
      systemctl restart ssh 2>/dev/null || systemctl restart sshd
    log "SSH password authentication disabled."
  else
    rm -f "${SSHD_DROPIN}"
    die "sshd config validation failed; reverted ${SSHD_DROPIN}."
  fi
fi

# -------------------------------------------------------------- fail2ban -----
log "Configuring fail2ban for SSH brute-force protection..."
cat >/etc/fail2ban/jail.local <<EOF
[DEFAULT]
# Ban for 1 hour after 5 failures within 10 minutes.
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = ${SSH_PORT}
maxretry = 5
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# Give the service a moment, then report jail status (non-fatal if unavailable).
sleep 1
fail2ban-client status sshd 2>/dev/null || warn "fail2ban sshd jail status not yet available."

log "Done. Summary:"
log "  • UFW: only ${SSH_PORT}/tcp (limited), 80/tcp, 443/tcp, 443/udp allowed."
log "  • SSH: password authentication $( [ "${ALLOW_PASSWORD_AUTH}" = "1" ] && echo "left ENABLED" || echo "DISABLED" )."
log "  • fail2ban: sshd jail active."
