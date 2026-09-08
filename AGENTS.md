# Clearance

- Read `../CLAUDE.md` for platform conventions. Only edit this project; siblings are operational references.
- The product name is **Clearance**. The local folder and SSH key currently use the original `clearence` spelling.
- Version one is titles only, automatically arranged with spacious placement. Preserve a neutral whiteboard appearance, dark sans-serif text, and minimal controls. No green palette, task-dashboard panels, or sample entries in real data.
- Node 24, built-in SQLite, no production dependencies. Bind to loopback and use Tailscale access control. Keep `/healthz`, `/api/widget`, the OS back-link and PWA shell.
- Never expose private keys, `.env`, or personal database contents. The deploy key stays on the Mac.
- Run `npm run check` and `npm test`; verify affected UI workflows with `npm run test:browser`.
- Number every question for Simon. At the end of the final response, collect all unanswered questions with their original numbers so he does not have to scroll. Do not scatter final questions between explanations.
