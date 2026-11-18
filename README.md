# Bet Desk

**Prioritise a Jira roadmap the way a portfolio manager sizes positions.**

Every open epic is a *bet*: it pays off `impact` if it lands, lands with probability `p`, and costs `effort` units of team capacity. Bet Desk scores each bet on risk-adjusted value per unit of capacity, then picks the set of bets that maximises total risk-adjusted value without exceeding capacity.

Built on Atlassian Forge for Codegeist 2026.

## The model

For each bet:

| Quantity | Formula | Meaning |
|---|---|---|
| EV | impact × p | expected payoff |
| σ | impact × √(p(1−p)) | standard deviation of a binary payoff |
| Risk-adjusted value | EV − λ·σ | λ = team's risk aversion (0 = risk-neutral) |
| Score | risk-adjusted value ÷ effort | value per unit of capacity |

Portfolio selection is a 0/1 knapsack on risk-adjusted value under the capacity limit (exact DP, effort discretised to 0.5). It beats ranking by score because it accounts for leftover capacity. Portfolio stats assume independent bets: total EV, portfolio σ = √Σσᵢ², and P(at least one lands) = 1 − Π(1 − pᵢ).

## Desk Analyst (Rovo agent)

Open Rovo chat in Jira and pick **Desk Analyst**. It reads the desk, proposes impact / p / effort for unestimated epics from their description and child-issue progress, asks before saving, and challenges flagged estimates (overconfident, long shot, negative edge, concentration).

## Project layout

```
manifest.yml               Forge app: Jira project page + resolver
src/scoring.js             pure scoring + allocation engine (unit-tested)
src/desk.js                shared data access: epics via JQL, estimates and settings in Forge KVS
src/index.js               resolver for the UI
src/agent.js               Rovo agent actions: read-desk, save-estimate
static/betdesk/            Custom UI: plain HTML/CSS/JS, bundled with esbuild
scripts/build.mjs          UI build
test/scoring.test.js       node:test unit tests
```

## Run it

```bash
npm install
npm test                    # scoring engine tests
forge lint                  # manifest check (after forge login)
npm install -g @forge/cli   # once
forge login                 # once, with an Atlassian API token
forge register              # once: writes your real app id into manifest.yml
npm run deploy              # build UI + forge deploy
forge install               # pick your Jira developer site
npm run tunnel              # live reload while developing
```

Open any Jira project → **Apps → Bet Desk**. Enter impact / P(success) / effort per epic, set capacity and λ, and the desk re-allocates.

## Licence

Apache 2.0. See [LICENSE](LICENSE).
