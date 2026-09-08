import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function fail(status, message) { return Object.assign(new Error(message), { status }); }
function clean(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'Expected an entry.');
  const out = {};
  for (const [key, limit] of Object.entries({ title: 240 })) {
    if (!(key in input)) continue;
    if (typeof input[key] !== 'string' || input[key].length > limit) throw fail(400, `Invalid ${key}.`);
    out[key] = input[key].trim();
  }
  if ('title' in out && !out.title) throw fail(400, 'Write a title first.');
  for (const key of ['x', 'y']) {
    if (!(key in input)) continue;
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < 0 || input[key] > 1) throw fail(400, 'Position must be between 0 and 1.');
    out[key] = input[key];
  }
  if ('archived' in input) {
    if (typeof input.archived !== 'boolean') throw fail(400, 'Invalid archive state.');
    out.archived = Number(input.archived);
  }
  return out;
}

export function openStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, updated TEXT NOT NULL
    );`);
  const parse = row => row ? { ...row, archived: Boolean(row.archived) } : null;
  const get = id => {
    const row = parse(db.prepare('SELECT * FROM entries WHERE id=?').get(id));
    if (!row) throw fail(404, 'This entry could not be found.');
    return row;
  };
  return {
    list: () => db.prepare('SELECT * FROM entries ORDER BY created, rowid').all().map(parse),
    get,
    add(input) {
      const value = clean(input);
      if (!value.title) throw fail(400, 'Write a title first.');
      const n = db.prepare('SELECT count(*) AS n FROM entries WHERE archived=0').get().n;
      const now = new Date().toISOString();
      const row = { id: randomUUID(), title: value.title, x: value.x ?? (.07 + (n % 3) * .32), y: value.y ?? (.08 + (Math.floor(n / 3) % 3) * .32), archived: 0, created: now, updated: now };
      db.prepare('INSERT INTO entries VALUES (:id,:title,:x,:y,:archived,:created,:updated)').run(row);
      return get(row.id);
    },
    update(id, input) {
      const row = { ...get(id), ...clean(input), updated: new Date().toISOString() };
      row.archived = Number(row.archived);
      db.prepare('UPDATE entries SET title=:title,x=:x,y=:y,archived=:archived,updated=:updated WHERE id=:id').run({ id, title: row.title, x: row.x, y: row.y, archived: row.archived, updated: row.updated });
      return get(id);
    },
    close: () => db.close(),
  };
}
