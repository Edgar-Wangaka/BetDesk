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

// Efficient frontier: one dot per distinct funded set across the λ sweep; the team's current λ in blue.
function renderFrontier(points) {
  const card = $('#frontier-card');
  if (!points || points.length < 2) { card.hidden = true; return; }
  card.hidden = false;
  const svg = $('#frontier');
  const W = svg.clientWidth || 600, H = svg.clientHeight || 220, m = { l: 44, r: 16, t: 12, b: 30 };
  const maxX = Math.max(...points.map((p) => p.sd)) || 1, maxY = Math.max(...points.map((p) => p.ev)) || 1;
  const x = (v) => m.l + (v / maxX) * (W - m.l - m.r), y = (v) => H - m.b - (v / maxY) * (H - m.t - m.b);
  const sorted = [...points].sort((a, b) => a.sd - b.sd);
  const lam = (p) => (p.lambdaMin === p.lambdaMax ? `λ ${p.lambdaMin}` : `λ ${p.lambdaMin}–${p.lambdaMax}`);
  svg.innerHTML = `
    <line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="#dfe1e6"/>
    <line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" stroke="#dfe1e6"/>
    <text x="${W - m.r}" y="${H - 8}" text-anchor="end">portfolio σ (risk) →</text>
    <text x="8" y="${m.t + 4}">EV</text>
    <polyline class="ln" points="${sorted.map((p) => `${x(p.sd)},${y(p.ev)}`).join(' ')}"/>
    ${points.map((p) => `<circle class="pt ${p.current ? 'cur' : ''}" cx="${x(p.sd)}" cy="${y(p.ev)}" r="${p.current ? 7 : 5}"><title>${esc(lam(p))}: ${p.count} bets, EV ${fmt(p.ev)}, σ ${fmt(p.sd)}\n${esc(p.keys)}</title></circle>`).join('')}`;
  const cur = points.find((p) => p.current), riskiest = sorted[sorted.length - 1];
  $('#frontier-note').textContent = cur && riskiest && riskiest !== cur
    ? `At your λ the desk earns EV ${fmt(cur.ev)} for σ ${fmt(cur.sd)}. Going fully risk-neutral would add ${fmt(riskiest.ev - cur.ev)} EV for ${fmt(riskiest.sd - cur.sd)} more σ.`
    : 'Your current λ already funds the highest-EV portfolio on the curve.';
}

function render(desk) {
  $('#capacity').value = desk.settings.capacity;
  $('#lambda').value = desk.settings.lambda;
  renderSummary(desk);
  renderFrontier(desk.frontier);
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

// Enter in any estimate field saves that row.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.dataset?.key) return;
  document.querySelector(`button[data-save="${CSS.escape(ev.target.dataset.key)}"]`)?.click();
});

document.addEventListener('click', async (ev) => {
  const key = ev.target.dataset?.save;
  if (key) {
    const val = (f) => document.querySelector(`input[data-key="${CSS.escape(key)}"][data-field="${f}"]`).value;
    ev.target.disabled = true;
    try {
      const res = await invoke('saveBet', { key, impact: val('impact'), p: val('p'), effort: val('effort') });
      if (!res.ok) return status(`${key}: ${res.errors.join('; ')}`);
      await load();
      document.querySelector(`button[data-save="${CSS.escape(key)}"]`)?.closest('tr')?.classList.add('saved');
    } finally {
      ev.target.disabled = false;
    }
    return;
  }
  if (ev.target.id === 'save-settings') {
    const res = await invoke('saveSettings', { capacity: $('#capacity').value, lambda: $('#lambda').value });
    if (!res.ok) return status(res.errors.join('; '));
    return load();
  }
});

load();
