# Bet Desk: build spec (draft, 18 Nov 2026)

Status: **draft for Edgar to correct.** Reconstructed from the one-line concept "portfolio-style roadmap prioritisation Forge app". Anything below that doesn't match the original idea should be overwritten.

## Event facts (verified 18 Nov 2026)
- Codegeist 2026, deadline **22 Dec 2026, 12:00 PM PT** (23:00 Nairobi), $120k pool.
- Tracks: Software teams, Business teams, Specialized industries.
- $1,500 bonus awards: Best Rovo Agent, Best MCP App, Best Teamwork Graph Integration, Best Marketplace Published App.
- Build with Forge, Rovo Agents or Atlassian MCP; a free Atlassian Cloud developer site is required.
- **Still to verify on Devpost:** judging criteria, repo/licence requirements, video length, track fit.

## Pitch
Roadmaps are capital allocation in disguise. Teams rank epics by gut or RICE and ignore uncertainty and capacity. Bet Desk treats each epic as a bet with a payoff, a probability and a cost, and funds the portfolio that maximises risk-adjusted value under capacity, the same way a PM sizes positions.

## Scope: MVP (done = demo-able)
- [x] Scoring engine: EV, σ, risk-adjusted value, score; knapsack allocation; portfolio stats (tests passing)
- [x] Jira project page listing open epics with editable impact / p / effort
- [x] Settings: capacity, λ (risk aversion); estimates stored in Forge KVS
- [ ] First deploy to a dev site and a screenshot
- [ ] Sentry wired in from the first deploy (per build rules)

## Scope: winning layer (pick ONE before 1 Dec)
1. **Rovo agent "Desk Analyst":** reads epic descriptions, linked issues and history, proposes p and effort with a rationale, and flags overconfident estimates. Targets the Best Rovo Agent bonus. **Built 18 Nov (not yet deployed):** `rovo:agent` + `read-desk` (GET) and `save-estimate` (UPDATE) actions; estimate flags (overconfident, long-shot, negative-edge, concentration) shown in the UI and given to the agent; agent-made estimates stored with their rationale and marked 🤖 in the table.
2. **Calibration loop:** when epics close, record hit/miss vs the p estimate, and show each estimator's Brier score. This is the differentiator a finance mind brings.
3. **Efficient frontier chart:** sweep λ and plot EV vs σ of the funded portfolio.

## Cheap extra bonus
- `rovo:mcp` module exposing `read-desk` as an MCP tool (Best MCP App bonus): a manifest-only change once the agent works on a live site.

## Out of scope
Correlated bets, multi-project portfolios, Monte Carlo, Marketplace listing (revisit after submission).

## Budget
25 build hours total, feature freeze 19 Dec (T-3).
