// Shared data access for the resolver (UI) and the Rovo agent actions.
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { allocate, flagBet, validateBet, frontier } from './scoring.js';
import { adfText, assertProjectKey } from './util.js';

export const DEFAULT_SETTINGS = { capacity: 10, lambda: 0.5 };
const betKey = (projectKey, issueKey) => `bet:${projectKey}:${issueKey}`;
const settingsKey = (projectKey) => `settings:${projectKey}`;

export async function fetchEpics(projectKey, { withDetail = false } = {}) {
  assertProjectKey(projectKey);
  const jql = `project = "${projectKey}" AND issuetype = Epic AND statusCategory != Done ORDER BY rank`;
  const fields = withDetail ? 'summary,status,description,created,duedate' : 'summary,status';
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=${fields}&maxResults=100`);
  if (!res.ok) throw new Error(`Jira search failed: ${res.status}`);
  const data = await res.json();
  return (data.issues || []).map((i) => ({
    key: i.key,
    title: i.fields.summary,
    status: i.fields.status?.name,
    ...(withDetail && {
      description: adfText(i.fields.description).slice(0, 2000),
      created: i.fields.created,
      dueDate: i.fields.duedate,
    }),
  }));
}

// Child-issue progress gives the agent evidence for p and effort.
export async function childProgress(epicKey) {
  if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(epicKey)) return null;
  const jql = `parent = "${epicKey}"`;
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=status&maxResults=200`);
  if (!res.ok) return null;
  const issues = (await res.json()).issues || [];
  const done = issues.filter((i) => i.fields.status?.statusCategory?.key === 'done').length;
  return { children: issues.length, done };
}

export async function getSettings(projectKey) {
  return { ...DEFAULT_SETTINGS, ...((await kvs.get(settingsKey(projectKey))) || {}) };
}

export async function saveSettings(projectKey, capacity, lambda) {
  if (!(capacity > 0) || !(lambda >= 0)) return { ok: false, errors: ['capacity must be > 0 and lambda >= 0'] };
  await kvs.set(settingsKey(projectKey), { capacity, lambda });
  return { ok: true };
}

export async function saveBet(projectKey, raw) {
  const bet = { key: raw.key, impact: Number(raw.impact), p: Number(raw.p), effort: Number(raw.effort) };
  const errors = validateBet(bet);
  if (errors.length) return { ok: false, errors };
  const record = { impact: bet.impact, p: bet.p, effort: bet.effort };
  if (raw.rationale) record.rationale = String(raw.rationale).slice(0, 1000);
  if (raw.source) record.source = raw.source; // 'human' | 'agent'
  await kvs.set(betKey(projectKey, bet.key), record);
  return { ok: true, bet: { ...bet, ...record } };
}

export async function getDesk(projectKey, { withDetail = false } = {}) {
  const [epics, settings] = await Promise.all([fetchEpics(projectKey, { withDetail }), getSettings(projectKey)]);
  const saved = await Promise.all(epics.map((e) => kvs.get(betKey(projectKey, e.key))));
  const bets = epics.map((e, i) => ({ ...e, ...(saved[i] || {}), estimated: Boolean(saved[i]) }));
  const estimated = bets.filter((b) => b.estimated);
  const result = allocate(estimated, settings.capacity, { lambda: settings.lambda });
  const ranked = result.ranked.map((b) => ({ ...b, flags: flagBet(b, result.portfolio) }));
  const curve = frontier(estimated, settings.capacity, { current: settings.lambda });
  return { projectKey, settings, ...result, ranked, frontier: curve, unestimated: bets.filter((b) => !b.estimated) };
}
