// Rovo agent actions for the Desk Analyst. Each action receives its inputs plus `context` in the payload.
import { getDesk, saveBet, childProgress } from './desk.js';

const projectFrom = (payload) =>
  payload.projectKey || payload.context?.jira?.projectKey || payload.context?.jira?.project?.key;

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
  const res = await saveBet(projectKey, {
    key: payload.issueKey, impact: payload.impact, p: payload.p, effort: payload.effort,
    rationale: payload.rationale, source: 'agent',
  });
  return res.ok ? { saved: res.bet } : { error: res.errors.join('; ') };
}
