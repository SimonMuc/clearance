# Clearance

A little space for what matters: a whiteboard for the few things you want to keep in view.

Click an empty area, write a title, press Enter. Titles automatically settle into a spacious arrangement near the place you chose. Drag to rearrange; click or right-click to rename. Set a thought aside when it no longer needs your attention, and bring it back from the archive whenever you want. On phones the board becomes a readable vertical layout.

Version one deliberately focuses on titles. Dates, detailed notes, links and pictures are reserved for a later version. The board starts empty, with no example content. Changes save to SQLite on the server; an internet/Tailscale connection is required for loading and saving your board.

## Development

Requires Node 24; no production npm dependencies.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:8795. Data lives in `data/clearance.sqlite`. `.env` and `data/` are ignored by Git.

```sh
npm run check
npm test
npm run test:browser
```

Browser verification uses Playwright, if installed in this project or in the adjacent Foresight project. It uses an isolated in-memory database. Screenshots are saved to ignored `artifacts/`. `npm run icons` regenerates the PWA icons. Keyboard: N to add; Enter to save; Escape to cancel; Alt + arrow keys on a title to reposition it.

## Run it on the server

The dedicated public key is registered in `SimonMuc/clearance` as a deploy key with write access. Its private key stays at `~/.ssh/clearence_ed25519` on the Mac. The original folder/key spelling is retained so existing setup continues to work; the product and GitHub repository are named Clearance.

```sh
git push -u origin main
sh scripts/deploy.sh
```

The deploy script forwards only this repository's key, clones to `/root/clearance`, creates `.env` on first installation, builds the Docker container, checks `/healthz`, and enables Tailscale HTTPS. It checks for occupied ports before cloning. Subsequent updates use the same script. Saved data and `.env` survive updates.

Port pair **8795 / 8450** was checked free on the server on 2026-09-08. The app binds to loopback, and Tailscale provides access control, following the other OS modules.

App URL: https://website.tailf4e733.ts.net:8450

OS registration: name **Clearance**, icon **◻**, open URL **:8450**, widget URL **http://127.0.0.1:8795/api/widget**, blurb **A little space for what matters.** The widget shows the number of visible thoughts and up to four titles. The header links back to OS.

Proposed parent registry row (the parent file is outside this site's edit boundary):

| Site | Container port | HTTPS port | GitHub | Mac key | Server dir | Update command |
| --- | --- | --- | --- | --- | --- | --- |
| `clearence/` — Clearance | 8795 | 8450 | `SimonMuc/clearance` | `~/.ssh/clearence_ed25519` | `/root/clearance` | `sh scripts/deploy.sh` |

Operational references inspected: `../CLAUDE.md`, Three Things' container pattern, OS's server/widget contract, Foresight's deployment discovery and script, and sibling package definitions. Sibling interfaces are not visual templates.

## API

- `GET /api/entries` lists visible and archived entries.
- `POST /api/entries` accepts `{ "title": "Something important", "x": 0, "y": 0 }`; positions are optional normalized preferences between 0 and 1.
- `PATCH /api/entries/:id` updates the title, preferred position, or boolean `archived` state.
- `GET /api/widget` returns the OS widget contract.
- `GET /healthz` returns `ok`.

No permanent-delete route is provided.
