// Rovo agent actions for the Desk Analyst. Each action receives its inputs plus `context` in the payload.
import { getDesk, saveBet, childProgress, fetchEpics } from './desk.js';
import { isProjectKey } from './util.js';

// The agent may pass a key typed by the user ("bd"), so normalise and validate it.
const projectFrom = (payload) => {
  const raw = payload.projectKey || payload.context?.jira?.projectKey || payload.context?.jira?.project?.key;
  const key = typeof raw === 'string' ? raw.trim().toUpperCase() : raw;
  return isProjectKey(key) ? key : null;
};

// Compact view of the desk for the agent: ranking, funded set, flags, and evidence for estimating.
export async function readDesk(payload) {
  const projectKey = projectFrom(payload);
  if (!projectKey) return { error: 'Ask the user which Jira project key to use.' };
  const desk = await getDesk(projectKey, { withDetail: true });
  const evidence = async (b) => ({ ...b, progress: await childProgress(b.key) });
  const pick = (b) => ({
    key: b.key, title: b.title, status: b.status, impact: b.impact, p: b.p, effort: b.effort,
    ev: b.ev, riskAdjusted: b.radj, score: b.score, funded: b.funded, flags: b.flags,
    rationale: b.rationale, source: b.source,
  });
  return {
    projectKey,
    settings: desk.settings,
    portfolio: desk.portfolio,
    ranked: desk.ranked.map(pick),
    unestimated: await Promise.all(
      desk.unestimated.map(async (b) => {
        const e = await evidence(b);
        return { key: e.key, title: e.title, status: e.status, description: e.description, created: e.created, dueDate: e.dueDate, progress: e.progress };
      }),
    ),
  };
}

// Save one estimate proposed by the agent, with its reasoning, after the user agrees.
export async function saveEstimate(payload) {
  const projectKey = projectFrom(payload);
  if (!projectKey) return { error: 'Ask the user which Jira project key to use.' };
  // Only save onto an open epic in this project: stops the agent writing estimates for a mistyped key.
  const epics = await fetchEpics(projectKey);
  const issueKey = String(payload.issueKey || '').trim().toUpperCase();
  if (!epics.some((e) => e.key === issueKey)) {
    return { error: `${issueKey || 'That key'} is not an open epic in ${projectKey}. Call read-desk and use a key from it.` };
  }
  const res = await saveBet(projectKey, {
    key: issueKey, impact: payload.impact, p: payload.p, effort: payload.effort,
    rationale: payload.rationale, source: 'agent',
  });
  return res.ok ? { saved: res.bet } : { error: res.errors.join('; ') };
}
