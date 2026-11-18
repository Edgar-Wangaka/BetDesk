// Bet Desk scoring engine.
// Every roadmap item is a bet: a binary payoff of `impact` that lands with probability `p`
// and costs `effort` units of team capacity. Pure functions, no Forge imports, so it is
// unit-testable and reusable by the resolver and (later) a Rovo agent action.

/**
 * @typedef {Object} Bet
 * @property {string} key      Jira issue key, e.g. "BD-12"
 * @property {string} [title]
 * @property {number} impact   Payoff if the bet lands (any consistent unit: $, points, 1-10)
 * @property {number} p        Probability of success, 0..1
 * @property {number} effort   Cost in capacity units (e.g. person-weeks), > 0
 */

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function validateBet(bet) {
  const errors = [];
  if (!bet || typeof bet.key !== 'string' || !bet.key) errors.push('key is required');
  if (!Number.isFinite(bet?.impact) || bet.impact < 0) errors.push('impact must be a number >= 0');
  if (!Number.isFinite(bet?.p) || bet.p < 0 || bet.p > 1) errors.push('p must be between 0 and 1');
  if (!Number.isFinite(bet?.effort) || bet.effort <= 0) errors.push('effort must be a number > 0');
  return errors;
}

/**
 * Per-bet statistics.
 * ev    = impact * p                      (expected payoff)
 * sd    = impact * sqrt(p * (1 - p))      (std dev of a Bernoulli payoff)
 * radj  = ev - lambda * sd                (risk-adjusted value; lambda = risk aversion)
 * score = radj / effort                   (risk-adjusted value per unit of capacity)
 */
export function scoreBet(bet, { lambda = 0.5 } = {}) {
  const p = clamp01(bet.p);
  const ev = bet.impact * p;
  const sd = bet.impact * Math.sqrt(p * (1 - p));
  const radj = ev - lambda * sd;
  return { ...bet, p, ev, sd, radj, score: radj / bet.effort };
}

/**
 * Portfolio-level stats for a set of bets, assuming independent outcomes.
 * pAnyWin = 1 - prod(1 - p_i)   (chance at least one bet lands)
 */
export function portfolioStats(bets) {
  const totalEffort = bets.reduce((s, b) => s + b.effort, 0);
  const ev = bets.reduce((s, b) => s + b.ev, 0);
  const sd = Math.sqrt(bets.reduce((s, b) => s + b.sd ** 2, 0));
  const pAnyWin = 1 - bets.reduce((prod, b) => prod * (1 - b.p), 1);
  return { count: bets.length, totalEffort, ev, sd, pAnyWin, evPerEffort: totalEffort ? ev / totalEffort : 0 };
}

/**
 * Choose the bets to fund under a capacity limit: 0/1 knapsack on risk-adjusted value.
 * Effort is discretised to `step` units (default 0.5) to keep the DP exact and small.
 * Bets with non-positive risk-adjusted value are never funded.
 */
export function allocate(bets, capacity, { lambda = 0.5, step = 0.5 } = {}) {
  const scored = bets.map((b) => scoreBet(b, { lambda }));
  const candidates = scored.filter((b) => b.radj > 0);
  const W = Math.floor(capacity / step + 1e-9);
  const w = candidates.map((b) => Math.max(1, Math.ceil(b.effort / step - 1e-9)));

  // dp[i][c] = best value using first i candidates with c capacity steps
  const n = candidates.length;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(W + 1));
  for (let i = 1; i <= n; i++) {
    const wi = w[i - 1];
    const vi = candidates[i - 1].radj;
    for (let c = 0; c <= W; c++) {
      dp[i][c] = dp[i - 1][c];
      if (wi <= c && dp[i - 1][c - wi] + vi > dp[i][c]) dp[i][c] = dp[i - 1][c - wi] + vi;
    }
  }
  const funded = new Set();
  for (let i = n, c = W; i > 0; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      funded.add(candidates[i - 1].key);
      c -= w[i - 1];
    }
  }

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const fundedBets = ranked.filter((b) => funded.has(b.key));
  return {
    ranked: ranked.map((b) => ({ ...b, funded: funded.has(b.key) })),
    funded: fundedBets,
    portfolio: portfolioStats(fundedBets),
    capacity,
    lambda,
  };
}
