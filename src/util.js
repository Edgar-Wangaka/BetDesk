// Small pure helpers shared by desk.js and the agent. No Forge imports, so they are unit-testable.

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'panel', 'tableRow']);

// Atlassian Document Format to plain text: inline nodes join with no separator,
// block nodes end with a newline (the old version split every text run onto its own line).
export function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'mention') return node.attrs?.text || '';
  const inner = (node.content || []).map(adfText).join('');
  return BLOCKS.has(node.type) ? `${inner.trim()}\n` : inner;
}

// Project keys go into JQL, and the agent can pass one from free text, so reject anything
// that is not a real key before it reaches a query.
export function isProjectKey(k) {
  return typeof k === 'string' && /^[A-Z][A-Z0-9_]{1,9}$/.test(k);
}

export function assertProjectKey(k) {
  if (!isProjectKey(k)) throw new Error(`Not a valid Jira project key: ${String(k).slice(0, 20)}`);
}
