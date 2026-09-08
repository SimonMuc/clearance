import { mkdirSync } from 'node:fs';
import { openStore } from '../src/store.js';
import { createApp } from '../src/server.js';
let playwright;
try { playwright = await import('@playwright/test'); }
catch { playwright = await import('../../foresight/node_modules/@playwright/test/index.mjs'); }
const { chromium, webkit, expect, devices } = playwright;
const store = openStore(':memory:');
const server = createApp({ store });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await (process.env.BROWSER_ENGINE === 'webkit' ? webkit : chromium).launch();
const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
mkdirSync('artifacts', { recursive: true });
async function add(title) {
  await page.locator('#add-button').click(); await page.locator('#quick-title').fill(title); await page.locator('#quick-title').press('Enter');
  await expect(page.locator('#composer')).toBeHidden(); await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
}
try {
  await page.goto(base); await expect(page.locator('#empty')).toBeVisible();
  await page.screenshot({ path: 'artifacts/desktop-empty.png', fullPage: true });
  const titles = ['Send the insurance photo', 'Make room for the things that matter.', 'Call about the apartment', 'A weekend without a plan', 'Book the appointment', 'What do I want the next year to look like?', 'Less, but with intention.'];
  for (const title of titles) await add(title);
  await expect(page.locator('.thought')).toHaveCount(7);
  await page.reload(); await expect(page.locator('.thought')).toHaveCount(7);
  const cards = await page.locator('.thought').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
  for (let a = 0; a < cards.length; a++) {
    expect(cards[a].bottom).toBeLessThan(960);
    for (let b = a + 1; b < cards.length; b++) expect(cards[a].right <= cards[b].x || cards[b].right <= cards[a].x || cards[a].bottom <= cards[b].y || cards[b].bottom <= cards[a].y).toBe(true);
  }
  await page.screenshot({ path: 'artifacts/desktop-board.png', fullPage: true });
  await page.getByRole('button', { name: titles[0], exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.locator('#detail-title').fill('Send the photo today'); await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#detail-dialog')).toBeHidden();
  const title = page.getByRole('button', { name: 'Send the photo today', exact: true });
  const oldPosition = { x: store.list()[0].x, y: store.list()[0].y };
  const r = await title.boundingBox();
  await page.mouse.move(r.x + 30, r.y + 15); await page.mouse.down(); await page.mouse.move(1150, 700, { steps: 12 }); await page.mouse.up();
  await expect.poll(() => store.list()[0].x).not.toBe(oldPosition.x);
  await expect(page.locator('#detail-dialog')).toBeHidden();
  await title.click(); await page.locator('#set-aside').click();
  await expect(page.locator('.thought')).toHaveCount(6); await page.locator('#undo-button').click(); await expect(page.locator('.thought')).toHaveCount(7);
  // A failed save retains the draft and never pretends it was saved.
  await page.route('**/api/entries', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Test connection unavailable"}' }) : route.continue());
  await page.locator('#add-button').click(); await page.locator('#quick-title').fill('Keep this unsaved draft'); await page.locator('#quick-title').press('Enter');
  await expect(page.locator('#compose-error')).toHaveText('Test connection unavailable'); await expect(page.locator('#quick-title')).toHaveValue('Keep this unsaved draft'); await page.locator('#quick-title').press('Escape');
  await page.unroute('**/api/entries');
  const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', defaultBrowserType: undefined });
  const phone = await context.newPage(); phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(base); await expect(phone.locator('.thought')).toHaveCount(7);
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await phone.screenshot({ path: 'artifacts/phone-board.png', fullPage: true });
  await phone.getByRole('button', { name: 'Send the photo today', exact: true }).tap();
  await phone.locator('#detail-title').fill('Photo sent — follow up'); await phone.getByRole('button', { name: 'Save changes' }).tap();
  await expect(phone.locator('#detail-dialog')).toBeHidden();
  await phone.getByRole('button', { name: 'Photo sent — follow up', exact: true }).tap(); await phone.locator('#set-aside').tap();
  await phone.locator('#archive-button').tap(); await expect(phone.locator('#archive-list')).toContainText('Photo sent — follow up'); await phone.getByRole('button', { name: 'Bring back' }).tap();
  await expect(phone.locator('#archive-list')).not.toContainText('Photo sent — follow up'); await phone.getByRole('button', { name: 'Close archive' }).tap();
  await phone.locator('#add-button').tap(); await phone.locator('#quick-title').fill('A phone thought'); await phone.getByRole('button', { name: 'Keep thought', exact: true }).tap();
  await expect(phone.locator('.thought')).toHaveCount(8);
  // Long titles and a larger board remain legible without horizontal overflow or overlapping cards.
  for (let i = 0; i < 6; i++) store.add({ title: `${i + 1}. ${'A longer thought that should wrap without hiding anything. '.repeat(4)}`.slice(0, 240) });
  await page.reload(); await expect(page.locator('.thought')).toHaveCount(14);
  const overlap = await page.locator('.thought').evaluateAll(nodes => { const rects = nodes.map(n => n.getBoundingClientRect()); return rects.some((a, i) => rects.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)); });
  expect(overlap).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log('Browser checks passed: quick entry, persistence, arrangement, dragging, rename, archive/undo/restore, failed-save recovery, iPhone, and long-title overflow.');
} finally {
  await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); store.close();
}
