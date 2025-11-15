
/**
 * Golden corpus tests: compare formatted output to expected files.
 * Run: npm run test:corpus
 */
const { test, describe } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { reflowTextAdoc } = require('../core');

const CORPUS_DIR = path.join(__dirname, 'corpus');
const WIDTH = 72; // width used for all corpus tests

function read(p) { return fs.readFileSync(p, 'utf8'); }
function pair(name) {
  return {
    input: path.join(CORPUS_DIR, `input-${name}.adoc`),
    expected: path.join(CORPUS_DIR, `expected-${name}.adoc`)
  };
}

describe('Golden corpus', () => {
  [
    'paragraphs',
    'lists',
    'admonitions',
    'blocks',
    'structure',
    'comments',
    'checklist',
    'admon-blocks',
    'source-blocks'
  ].forEach(name => {
    test(name, () => {
      const { input, expected } = pair(name);
      const got = reflowTextAdoc(read(input), WIDTH);
      const want = read(expected);
      if (got !== want) {
        const gl = got.split(/\r?\n/);
        const wl = want.split(/\r?\n/);
        let i = 0, max = Math.max(gl.length, wl.length);
        for (; i < max; i++) if ((gl[i] ?? '') !== (wl[i] ?? '')) break;
        throw new Error(
          `Mismatch in '${name}' at line ${i+1}\n`+
          `got : ${JSON.stringify(gl[i] ?? '')}\n`+
          `want: ${JSON.stringify(wl[i] ?? '')}`
        );
      }
    });
  });
});
