#!/bin/sh
# Run on the Mac after granting the Clearance deploy key access to GitHub.
# The private key stays on the Mac. Only this repo's identity is forwarded.
set -eu
clearance_key="$HOME/.ssh/clearence_ed25519"
test -f "$clearance_key" || { echo 'Missing ~/.ssh/clearence_ed25519'; exit 1; }
export CLEARANCE_DEPLOY_KEY="$clearance_key"
export CLEARANCE_DEPLOY_HOST="${CLEARANCE_SSH_HOST:-website.tailf4e733.ts.net}"
ssh-agent sh -c '
  ssh-add -q "$CLEARANCE_DEPLOY_KEY"
  ssh -A -t -o HostKeyAlias=100.97.8.10 root@"$CLEARANCE_DEPLOY_HOST" '\''
    set -eu
    if [ ! -d /root/clearance/.git ]; then
      if ss -ltn | awk "{print \$4}" | grep -Eq ":(8795|8450)$"; then
        echo "Port 8795 or 8450 is occupied. Check the platform registry before deploying."
        exit 1
      fi
      cd /root
      git clone git@github.com:SimonMuc/clearance.git clearance
    fi
    cd /root/clearance
    git pull --ff-only
    if [ ! -f .env ]; then cp .env.example .env; fi
    docker compose up -d --build
    tries=0
    until curl -fsS http://127.0.0.1:8795/healthz; do
      tries=$((tries + 1))
      [ "$tries" -lt 15 ] || exit 1
      sleep 2
    done
    tailscale serve --bg --https=8450 8795
  '\''
'
