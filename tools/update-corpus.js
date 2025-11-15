// tools/update-corpus.js
// Regenerate expected-*.adoc from input-*.adoc using current formatter.
// Usage: node tools/update-corpus.js

const fs = require('fs');
const path = require('path');
const { reflowTextAdoc } = require('../core');

const CORPUS_DIR = path.join(__dirname, '..', 'test', 'corpus');
const WIDTH = 72;

const files = fs.readdirSync(CORPUS_DIR)
  .filter(f => /^input-.*\.adoc$/.test(f))
  .sort();

for (const f of files) {
  const name = f.replace(/^input-/, '');
  const inputPath = path.join(CORPUS_DIR, f);
  const expectedPath = path.join(CORPUS_DIR, 'expected-' + name);

  const input = fs.readFileSync(inputPath, 'utf8');
  const out = reflowTextAdoc(input, WIDTH);

  fs.writeFileSync(expectedPath, out, 'utf8');
  console.log('Updated', path.basename(expectedPath));
}

console.log('\nDone. Now run:  npm run test:corpus');
