import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreBet, portfolioStats, allocate, validateBet } from '../src/scoring.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('scoreBet: EV, Bernoulli sd, risk adjustment', () => {
  const s = scoreBet({ key: 'A', impact: 100, p: 0.5, effort: 2 }, { lambda: 0.5 });
  close(s.ev, 50);
  close(s.sd, 50);
  close(s.radj, 25);
  close(s.score, 12.5);
});

test('scoreBet: certain bet has zero risk', () => {
  const s = scoreBet({ key: 'A', impact: 10, p: 1, effort: 1 });
  close(s.sd, 0);
  close(s.radj, 10);
});

test('portfolioStats: independent bets', () => {
  const bets = [scoreBet({ key: 'A', impact: 10, p: 0.5, effort: 1 }), scoreBet({ key: 'B', impact: 10, p: 0.5, effort: 1 })];
  const st = portfolioStats(bets);
  close(st.ev, 10);
  close(st.sd, Math.sqrt(50));
  close(st.pAnyWin, 0.75);
});

test('allocate: knapsack beats greedy-by-score', () => {
  // Greedy by score takes A then B (value 16); the optimum is B + C (value 20).
  const bets = [
    { key: 'A', impact: 6, p: 1, effort: 1 },
    { key: 'B', impact: 10, p: 1, effort: 2 },
    { key: 'C', impact: 10, p: 1, effort: 2 },
  ];
  const r = allocate(bets, 4, { lambda: 0 });
  assert.deepEqual(r.funded.map((b) => b.key).sort(), ['B', 'C']);
  close(r.portfolio.ev, 20);
});

test('allocate: never funds bets with non-positive risk-adjusted value', () => {
  const r = allocate([{ key: 'X', impact: 10, p: 0.05, effort: 1 }], 10, { lambda: 1 });
  assert.equal(r.funded.length, 0);
});

test('validateBet flags bad input', () => {
  assert.equal(validateBet({ key: 'A', impact: 1, p: 0.5, effort: 1 }).length, 0);
  assert.equal(validateBet({ key: '', impact: -1, p: 2, effort: 0 }).length, 4);
});

import { flagBet } from '../src/scoring.js';

test('flagBet: overconfident large bet and long shot', () => {
  const big = scoreBet({ key: 'A', impact: 10, p: 0.95, effort: 6 });
  assert.deepEqual(flagBet(big).map((f) => f.code), ['overconfident']);
  const shot = scoreBet({ key: 'B', impact: 10, p: 0.05, effort: 1 }, { lambda: 1 });
  assert.deepEqual(flagBet(shot).map((f) => f.code), ['long-shot', 'negative-edge']);
});

test('flagBet: concentration in the funded portfolio', () => {
  const r = allocate([{ key: 'A', impact: 10, p: 0.8, effort: 1 }, { key: 'B', impact: 2, p: 0.8, effort: 1 }], 5, { lambda: 0 });
  const a = r.ranked.find((b) => b.key === 'A');
  assert.ok(flagBet(a, r.portfolio).some((f) => f.code === 'concentration'));
});
