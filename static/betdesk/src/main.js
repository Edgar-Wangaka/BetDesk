import { invoke } from '@forge/bridge';

const $ = (sel) => document.querySelector(sel);
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
// Floor, not round: never display certainty that isn't there (0.996 shows as 99.6%, not 100%).
const pct = (x) => (Number.isFinite(x) ? `${(Math.floor(x * 1000) / 10).toFixed(1)}%` : '–');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function status(msg) { $('#status').textContent = msg || ''; }

function renderSummary(desk) {
  const p = desk.portfolio;
  const stats = [
    [`${p.count}`, 'bets funded'],
    [`${fmt(p.totalEffort)} / ${fmt(desk.capacity)}`, 'capacity used'],
    [fmt(p.ev), 'portfolio EV'],
    [fmt(p.sd), 'portfolio σ'],
    [pct(p.pAnyWin), 'P(at least one lands)'],
  ];
  $('#summary').innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
}

function inputCell(key, field, value, attrs) {
  return `<input data-key="${esc(key)}" data-field="${field}" type="number" value="${value ?? ''}" ${attrs} />`;
}

function row(b, estimated) {
  return `<tr class="${b.funded ? 'funded' : ''}">
    <td title="${esc(b.title)}">${esc(b.key)} <small>${esc(b.title)}</small></td>
    <td>${inputCell(b.key, 'impact', b.impact, 'min="0" step="1"')}</td>
    <td>${inputCell(b.key, 'p', b.p, 'min="0" max="1" step="0.05"')}</td>
    <td>${inputCell(b.key, 'effort', b.effort, 'min="0.5" step="0.5"')}</td>
    <td class="num">${estimated ? fmt(b.ev) : ''}</td>
    <td class="num">${estimated ? fmt(b.radj) : ''}</td>
    <td class="num">${estimated ? fmt(b.score, 2) : ''}</td>
    <td>${estimated ? (b.funded ? '✅' : '—') : 'needs estimate'}${(b.flags || []).map((f) => ` <span class="flag" title="${esc(f.message)}">⚠ ${esc(f.code)}</span>`).join('')}${b.source === 'agent' ? ' <span class="flag" title="' + esc(b.rationale) + '">🤖 agent</span>' : ''}</td>
    <td><button class="secondary" data-save="${esc(b.key)}">Save</button></td>
  </tr>`;
}

function render(desk) {
  $('#capacity').value = desk.settings.capacity;
  $('#lambda').value = desk.settings.lambda;
  renderSummary(desk);
  $('#bets tbody').innerHTML =
    desk.ranked.map((b) => row(b, true)).join('') + desk.unestimated.map((b) => row(b, false)).join('');
}

async function load() {
  status('Loading…');
  try {
    render(await invoke('getDesk'));
    status('');
  } catch (e) {
    status(`Could not load: ${e.message}`);
  }
}

document.addEventListener('click', async (ev) => {
  const key = ev.target.dataset?.save;
  if (key) {
    const val = (f) => document.querySelector(`input[data-key="${CSS.escape(key)}"][data-field="${f}"]`).value;
    const res = await invoke('saveBet', { key, impact: val('impact'), p: val('p'), effort: val('effort') });
    if (!res.ok) return status(res.errors.join('; '));
    return load();
  }
  if (ev.target.id === 'save-settings') {
    const res = await invoke('saveSettings', { capacity: $('#capacity').value, lambda: $('#lambda').value });
    if (!res.ok) return status(res.errors.join('; '));
    return load();
  }
});

load();
