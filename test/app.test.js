import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.js';
import { createApp } from '../src/server.js';

test('titles, placement and archive survive restarting the database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'clearance-test-'));
  let store = openStore(join(dir, 'test.sqlite'));
  try {
    assert.deepEqual(store.list(), []);
    const entry = store.add({ title: '  Send the photo  ', x: .8, y: .2 });
    store.update(entry.id, { title: 'Send insurance photo', archived: true });
    store.close(); store = openStore(join(dir, 'test.sqlite'));
    assert.equal(store.get(entry.id).title, 'Send insurance photo');
    assert.equal(store.get(entry.id).x, .8);
    assert.equal(store.get(entry.id).archived, true);
    store.update(entry.id, { archived: false });
    assert.equal(store.get(entry.id).archived, false);
    for (const input of [{ title: '' }, { title: 'a'.repeat(241) }, { title: 123 }, { title: 'ok', x: -1 }, { title: 'ok', y: NaN }]) assert.throws(() => store.add(input), { status: 400 });
    assert.throws(() => store.update('missing', { title: 'New' }), { status: 404 });
  } finally { store.close(); rmSync(dir, { recursive: true }); }
});

test('HTTP entry workflow, OS widget, and rejected cross-origin writes', async () => {
  const store = openStore(':memory:');
  const server = createApp({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, body, method = 'POST', headers = {}) => fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal(await (await fetch(base + '/healthz')).text(), 'ok');
    assert.equal((await request('/api/entries', { title: 'Blocked' }, 'POST', { Origin: 'https://other.example' })).status, 403);
    assert.equal((await request('/api/entries', null)).status, 400);
    assert.equal((await request('/api/entries', { title: 'x'.repeat(101000) })).status, 413);
    const res = await request('/api/entries', { title: '<script>literal text</script>' });
    assert.equal(res.status, 201); const entry = await res.json();
    const widget = await (await fetch(base + '/api/widget')).json();
    assert.equal(widget.value, '1'); assert.equal(widget.lines[0], entry.title);
    assert.equal((await request(`/api/entries/${entry.id}`, { archived: true }, 'PATCH')).status, 200);
    assert.equal((await (await fetch(base + '/api/widget')).json()).value, '0');
    assert.equal((await fetch(base + '/src/store.js')).status, 404);
    assert.equal((await fetch(base + '/')).status, 200);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); store.close(); }
});
