const $ = selector => document.querySelector(selector);
const board = $('#board'), composer = $('#composer'), quick = $('#quick-title');
const detail = $('#detail-dialog'), archive = $('#archive-dialog'), menu = $('#context-menu');
let entries = [], position = { x: .1, y: .1 }, editing = null, menuId = null, undoId = null, busy = false, loaded = false;
const mobile = () => matchMedia('(max-width:700px)').matches;
const active = () => entries.filter(e => !e.archived);
const clamp = value => Math.min(1, Math.max(0, value));
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
async function api(path, body, method = 'PATCH') {
  const res = await fetch(path, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { let message = 'Could not save. Please try again.'; try { message = (await res.json()).error || message; } catch {} throw new Error(message); }
  return res.json();
}
function toast(message, id = null) { undoId = id; $('#toast span').textContent = message; $('#undo-button').hidden = !id; $('#toast').hidden = false; }
async function update(id, data) {
  $('#save-state').textContent = 'Saving…';
  try {
    const saved = await api(`/api/entries/${id}`, data);
    entries = entries.map(e => e.id === id ? saved : e);
    $('#save-state').textContent = 'Saved'; render(); return saved;
  } catch (error) { $('#save-state').textContent = 'Not saved'; throw error; }
}
function place(el, entry) {
  el.style.left = `${entry.x * Math.max(0, board.clientWidth - el.offsetWidth)}px`;
  el.style.top = `${entry.y * Math.max(0, board.clientHeight - el.offsetHeight)}px`;
}
function arrange() {
  if (mobile()) { board.style.minHeight = ''; return; }
  const cards = [...document.querySelectorAll('.thought')];
  const columns = board.clientWidth < 850 ? 2 : 3;
  const rows = Math.max(3, Math.ceil(cards.length / columns));
  const width = Math.min(330, board.clientWidth / columns - 36);
  for (const card of cards) card.style.width = `${width}px`;
  const rowHeight = Math.max(150, ...cards.map(card => card.offsetHeight + 40));
  board.style.minHeight = `${Math.max(innerHeight - 211, rows * rowHeight)}px`;
  const cellWidth = board.clientWidth / columns, cellHeight = board.clientHeight / rows;
  const occupied = new Set();
  for (const card of cards) {
    const entry = entries.find(item => item.id === card.dataset.id);
    const preferredCol = Math.round(entry.x * (columns - 1));
    const preferredRow = Math.round(entry.y * (rows - 1));
    const slots = Array.from({ length: columns * rows }, (_, i) => i).filter(i => !occupied.has(i));
    slots.sort((a, b) => ((a % columns - preferredCol) ** 2 + (Math.floor(a / columns) - preferredRow) ** 2) - ((b % columns - preferredCol) ** 2 + (Math.floor(b / columns) - preferredRow) ** 2));
    const slot = slots[0]; occupied.add(slot);
    card.style.left = `${(slot % columns) * cellWidth + (cellWidth - width) / 2}px`;
    card.style.top = `${Math.floor(slot / columns) * cellHeight + Math.max(20, (cellHeight - card.offsetHeight) / 2)}px`;
  }
}
function render() {
  const visible = active();
  $('#entries').replaceChildren();
  $('#empty').hidden = visible.length > 0 || !loaded;
  $('#count').textContent = visible.length ? `${String(visible.length).padStart(2, '0')} in view` : '';
  $('#archive-count').textContent = entries.filter(e => e.archived).length;
  $('#board-hint').textContent = mobile() ? 'Add a thought. Tap it for a closer look.' : 'Click anywhere to write. Drag to rearrange.';
  for (const entry of visible) {
    const card = node('article', 'thought'); card.dataset.id = entry.id;
    const title = node('button', 'thought-title', entry.title);
    title.setAttribute('aria-label', entry.title); title.title = 'Rename · drag to rearrange';
    const more = node('button', 'thought-menu', '···'); more.setAttribute('aria-label', `Options for ${entry.title}`);
    more.onclick = event => { const r = more.getBoundingClientRect(); showMenu(event, entry.id, r.left, r.bottom); };
    card.append(title, more); $('#entries').append(card);
    card.oncontextmenu = event => showMenu(event, entry.id, event.clientX, event.clientY);
    attachDrag(card, title, entry);
  }
  arrange();
  if (archive.open) renderArchive();
}
function attachDrag(card, title, entry) {
  let drag = null, suppressClick = false;
  title.onclick = event => { event.stopPropagation(); if (suppressClick) { suppressClick = false; return; } openDetail(entry.id); };
  title.onpointerdown = event => {
    if (mobile() || event.button !== 0) return;
    drag = { sx: event.clientX, sy: event.clientY, left: card.offsetLeft, top: card.offsetTop, moved: false };
    title.setPointerCapture(event.pointerId);
  };
  title.onpointermove = event => {
    if (!drag) return;
    const dx = event.clientX - drag.sx, dy = event.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; card.classList.add('dragging');
    card.style.left = `${Math.max(0, Math.min(board.clientWidth - card.offsetWidth, drag.left + dx))}px`;
    card.style.top = `${Math.max(0, Math.min(board.clientHeight - card.offsetHeight, drag.top + dy))}px`;
  };
  title.onpointerup = async () => {
    if (!drag) return;
    const moved = drag.moved; drag = null; card.classList.remove('dragging');
    if (!moved) return;
    suppressClick = true;
    try { await update(entry.id, { x: clamp(card.offsetLeft / Math.max(1, board.clientWidth - card.offsetWidth)), y: clamp(card.offsetTop / Math.max(1, board.clientHeight - card.offsetHeight)) }); }
    catch(error) { render(); toast(error.message); }
  };
  title.onpointercancel = () => { drag = null; card.classList.remove('dragging'); render(); };
  title.onkeydown = async event => {
    if (!event.altKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const x = clamp(entry.x + (event.key === 'ArrowLeft' ? -.04 : event.key === 'ArrowRight' ? .04 : 0));
    const y = clamp(entry.y + (event.key === 'ArrowUp' ? -.04 : event.key === 'ArrowDown' ? .04 : 0));
    try { await update(entry.id, { x, y }); document.querySelector(`[data-id="${entry.id}"] .thought-title`)?.focus(); } catch(error) { toast(error.message); }
  };
}
function showComposer(x, y) {
  if (!loaded) { toast('The board has not loaded yet. Reload to try again.'); return; }
  if (!composer.hidden) { quick.focus(); return; }
  const n = active().length;
  position = x === undefined ? { x: .07 + n % 3 * .32, y: .08 + Math.floor(n / 3) % 3 * .32 } : { x: clamp(x / Math.max(1, board.clientWidth - 280)), y: clamp(y / Math.max(1, board.clientHeight - 130)) };
  composer.hidden = false; place(composer, position); $('#compose-error').textContent = ''; quick.focus();
}
function closeComposer() { composer.hidden = true; quick.value = ''; board.focus(); }
$('#add-button').onclick = () => showComposer(); $('#first-button').onclick = () => showComposer();
board.onclick = event => { if (event.target === board || event.target === $('#entries')) { const rect = board.getBoundingClientRect(); showComposer(event.clientX - rect.left, event.clientY - rect.top); } };
composer.onclick = event => event.stopPropagation();
quick.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); composer.requestSubmit(); } if (event.key === 'Escape') closeComposer(); };
composer.onsubmit = async event => {
  event.preventDefault(); if (busy || !quick.value.trim()) return;
  busy = true; quick.disabled = true;
  try { const entry = await api('/api/entries', { title: quick.value.trim(), ...position }, 'POST'); entries.push(entry); closeComposer(); render(); $('#save-state').textContent = 'Saved'; }
  catch(error) { $('#compose-error').textContent = error.message; }
  finally { busy = false; quick.disabled = false; if (!composer.hidden) quick.focus(); }
};
function showMenu(event, id, x, y) {
  event.preventDefault(); event.stopPropagation(); menuId = id; menu.hidden = false;
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - 195))}px`; menu.style.top = `${Math.max(8, Math.min(y, innerHeight - 110))}px`;
  menu.querySelector('button').focus();
}
document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.hidden = true; });
menu.onkeydown = event => { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); const buttons = [...menu.querySelectorAll('button')]; buttons[(buttons.indexOf(document.activeElement) + 1) % buttons.length].focus(); } };
$('#context-edit').onclick = () => { menu.hidden = true; openDetail(menuId); };
$('#context-archive').onclick = () => { menu.hidden = true; setAside(menuId); };
function openDetail(id) {
  const entry = entries.find(e => e.id === id); if (!entry) return;
  editing = id; $('#detail-title').value = entry.title; $('#detail-error').textContent = ''; detail.showModal();
}
$('#detail-form').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try { await update(editing, { title: $('#detail-title').value }); detail.close(); }
  catch(error) { $('#detail-error').textContent = error.message; }
  finally { button.disabled = false; }
};
async function setAside(id) {
  try { await update(id, { archived: true }); if (detail.open) detail.close(); toast('Thought set aside.', id); }
  catch(error) { toast(error.message); }
}
$('#set-aside').onclick = () => setAside(editing);
$('#undo-button').onclick = async () => { try { await update(undoId, { archived: false }); $('#toast').hidden = true; } catch(error) { toast(error.message); } };
$('#dismiss-toast').onclick = () => { $('#toast').hidden = true; };
function renderArchive() {
  const list = $('#archive-list'); list.replaceChildren();
  const saved = entries.filter(e => e.archived);
  if (!saved.length) list.append(node('p', 'archive-intro', 'Nothing set aside yet.'));
  for (const entry of saved) {
    const row = node('div', 'archive-row'), restore = node('button', '', 'Bring back');
    restore.onclick = async () => { restore.disabled = true; try { await update(entry.id, { archived: false }); } catch(error) { toast(error.message); restore.disabled = false; } };
    row.append(node('span', '', entry.title), restore); list.append(row);
  }
}
$('#archive-button').onclick = () => { renderArchive(); archive.showModal(); };
document.querySelectorAll('.close').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { menu.hidden = true; if (!composer.hidden && !busy) closeComposer(); }
  if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey && !['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName) && !detail.open && !archive.open) { event.preventDefault(); showComposer(); }
});
new ResizeObserver(() => { render(); if (!composer.hidden) place(composer, position); }).observe(board);
async function load() {
  try { entries = await api('/api/entries'); loaded = true; render(); }
  catch(error) { $('#save-state').textContent = 'Board unavailable'; toast('Could not load your board. Reload to try again.'); }
  try { const config = await api('/api/config'); const url = new URL(config.osUrl); if (['https:','http:'].includes(url.protocol)) $('#os-link').href = url.href; } catch {}
}
await load();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
