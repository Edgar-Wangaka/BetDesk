import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { allocate, validateBet } from './scoring.js';

const resolver = new Resolver();
const betKey = (projectKey, issueKey) => `bet:${projectKey}:${issueKey}`;
const settingsKey = (projectKey) => `settings:${projectKey}`;
const DEFAULT_SETTINGS = { capacity: 10, lambda: 0.5 };

// Open epics in the current project become candidate bets.
async function fetchEpics(projectKey) {
  const jql = `project = "${projectKey}" AND issuetype = Epic AND statusCategory != Done ORDER BY rank`;
  const res = await api
    .asUser()
    .requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary,status&maxResults=100`);
  if (!res.ok) throw new Error(`Jira search failed: ${res.status}`);
  const data = await res.json();
  return (data.issues || []).map((i) => ({ key: i.key, title: i.fields.summary, status: i.fields.status?.name }));
}

resolver.define('getDesk', async ({ context }) => {
  const projectKey = context.extension.project.key;
  const [epics, settings] = await Promise.all([fetchEpics(projectKey), kvs.get(settingsKey(projectKey))]);
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const saved = await Promise.all(epics.map((e) => kvs.get(betKey(projectKey, e.key))));

  const bets = epics.map((e, i) => ({ ...e, ...(saved[i] || {}), estimated: Boolean(saved[i]) }));
  const estimated = bets.filter((b) => b.estimated);
  const result = allocate(estimated, s.capacity, { lambda: s.lambda });
  return { projectKey, settings: s, unestimated: bets.filter((b) => !b.estimated), ...result };
});

resolver.define('saveBet', async ({ payload, context }) => {
  const projectKey = context.extension.project.key;
  const bet = { key: payload.key, impact: Number(payload.impact), p: Number(payload.p), effort: Number(payload.effort) };
  const errors = validateBet(bet);
  if (errors.length) return { ok: false, errors };
  await kvs.set(betKey(projectKey, bet.key), { impact: bet.impact, p: bet.p, effort: bet.effort });
  return { ok: true };
});

resolver.define('saveSettings', async ({ payload, context }) => {
  const projectKey = context.extension.project.key;
  const capacity = Number(payload.capacity);
  const lambda = Number(payload.lambda);
  if (!(capacity > 0) || !(lambda >= 0)) return { ok: false, errors: ['capacity must be > 0 and lambda >= 0'] };
  await kvs.set(settingsKey(projectKey), { capacity, lambda });
  return { ok: true };
});

export const handler = resolver.getDefinitions();
