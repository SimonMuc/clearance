# Clearance deploy: independent of the local project's folder spelling.
update-clearance() {
  ssh-agent sh -c 'ssh-add -q "$HOME/.ssh/clearence_ed25519" && ssh -A -t -o HostKeyAlias=100.97.8.10 root@website.tailf4e733.ts.net "cd /root/clearance && git pull --ff-only && docker compose up -d --build"'
}
