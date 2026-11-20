import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adfText, isProjectKey } from '../src/util.js';
import { frontier } from '../src/scoring.js';

test('adfText keeps inline runs together and breaks between paragraphs', () => {
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Ship ' }, { type: 'text', text: 'M-Pesa', marks: [{ type: 'strong' }] }, { type: 'text', text: ' checkout.' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Risk: KYC' }] }] }] },
  ] };
  assert.equal(adfText(doc).trim(), 'Ship M-Pesa checkout.\nRisk: KYC');
});

test('isProjectKey accepts real keys and rejects JQL fragments', () => {
  assert.ok(isProjectKey('BD'));
  assert.ok(isProjectKey('PAY2'));
  assert.ok(!isProjectKey('bd'));
  assert.ok(!isProjectKey('BD" OR project = "HR'));
  assert.ok(!isProjectKey(undefined));
});

test('frontier: more risk aversion never raises portfolio σ, and marks the current λ', () => {
  const bets = [
    { key: 'SAFE', impact: 4, p: 0.95, effort: 2 },
    { key: 'CORE', impact: 8, p: 0.7, effort: 3 },
    { key: 'MOON', impact: 20, p: 0.25, effort: 3 },
    { key: 'MID', impact: 6, p: 0.6, effort: 2 },
  ];
  const pts = frontier(bets, 6, { current: 0.5 });
  assert.ok(pts.length >= 2, 'sweep should produce distinct portfolios');
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].sd <= pts[i - 1].sd + 1e-9);
  assert.equal(pts.filter((p) => p.current).length, 1);
  assert.ok(pts[0].ev >= pts[pts.length - 1].ev);
});
