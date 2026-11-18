// Bundles the Custom UI (plain JS + @forge/bridge) into static/betdesk/build.
import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';

const src = 'static/betdesk';
const out = `${src}/build`;
mkdirSync(out, { recursive: true });
await build({ entryPoints: [`${src}/src/main.js`], bundle: true, minify: true, format: 'iife', outfile: `${out}/main.js` });
for (const f of ['index.html', 'style.css']) copyFileSync(`${src}/${f}`, `${out}/${f}`);
console.log(`built ${out}`);
