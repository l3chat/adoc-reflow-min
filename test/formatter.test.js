
/**
 * Unit tests for AsciiDoc Reflow core
 * Run: npm test
 */
const { test, describe } = require('node:test');
const assert = require('assert');
const { reflowTextAdoc } = require('../core');

function fmt(input, width = 40) {
  const out = reflowTextAdoc(input, width);
  const out2 = reflowTextAdoc(out, width);
  assert.strictEqual(out, out2, 'Formatter must be idempotent at given width');
  out.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;                        // blank ok
    if (/^ [^\s]/.test(line)) return;               // literal paragraph preserved
    if (/^[^\s]*[a-z]+:\/\/\S+/.test(line)) return; // long URL allowed
    if (/^(?:[.=*+\-]{4,}|\/\/\/\/|--|\|===)$/.test(line.trim())) return; // fences
    assert.ok(line.length <= width, `Line exceeds width ${width}: ${JSON.stringify(line)}`);
  });
  return out;
}

describe('Paragraphs', () => {
  test('basic reflow, words preserved', () => {
    const input = `We do not always use precisely this phrase.
In some cases, “the process of transmitting information” goes by different names.
`;
    const out = fmt(input, 50);
    assert.match(out, /^We do not always use precisely this phrase\./);
    assert.ok(out.includes('different names.'));
  });

  test('hard line breaks (trailing " +") preserved', () => {
    const input = `Line one +\nline two +\nline three\n`;
    const out = fmt(input, 20);
    assert.strictEqual(out, input);
  });

  test('URLs not split', () => {
    const input = `See https://example.com/some/really/long/path?with=query for details in this very long sentence that should wrap.\n`;
    const out = fmt(input, 40);
    assert.ok(out.includes('https://example.com/some/really/long/path?with=query'));
  });

  test('literal paragraph (leading space) preserved', () => {
    const input = ` A literal paragraph starts with a space\n and continues like this\n\nNormal paragraph wraps nicely across words.\n`;
    const out = fmt(input, 30);
    assert.ok(out.includes(' A literal paragraph starts with a space'));
    assert.ok(out.includes(' and continues like this'));
    assert.match(out, /Normal paragraph wraps nicely/);
  });
});

describe('Lists', () => {
  test('simple bullet item with hanging indent', () => {
    const input = `* This is a long list item that must wrap with hanging indent under the bullet.\n`;
    const out = fmt(input, 40);
    const lines = out.trimEnd().split('\n');
    assert.ok(lines.length >= 2);
    assert.ok(/^\* /.test(lines[0]));
    assert.ok(/^ {2,}/.test(lines[1])); // allow 2+ spaces
  });

  test('definition list with hanging indent', () => {
    const input = `Term:: This definition should wrap under the "Term:: " prefix and align nicely.\n`;
    const out = fmt(input, 40);
    const lines = out.trim().split('\n');
    assert.ok(/^Term:: /.test(lines[0]));
    if (lines[1]) assert.ok(/^       /.test(lines[1])); // 7 spaces after "Term:: "
  });

  test('nested list kept as-is (complex)', () => {
    const input = `* Parent item
** Child item nested should not be reflowed.
`;
    const out = reflowTextAdoc(input, 40);
    assert.strictEqual(out, input);
  });

  test('continuation marker + keeps attached block as-is', () => {
    const input = `* Item top line\n+\nAttached paragraph must not merge with the bullet.\n`;
    const out = fmt(input, 50);
    assert.strictEqual(out, input);
  });

  test('checklist items format with hanging indent', () => {
    const input = `* [x] A done task that should wrap with a hanging indent after the checklist marker.\n`;
    const out = fmt(input, 50);
    const lines = out.trimEnd().split('\n');
    assert.ok(/^\* \[x\] /.test(lines[0]) || /^\* /.test(lines[0]));
    if (lines[1]) assert.ok(/^ {2,}/.test(lines[1]));
  });
});

describe('Admonitions', () => {
  test('single-line admonition wraps with hanging indent', () => {
    const input = `NOTE: This is a long admonition message that should wrap under the NOTE prefix cleanly and predictably.\n`;
    const out = fmt(input, 40);
    const lines = out.trim().split('\n');
    assert.ok(/^NOTE: /.test(lines[0]));
    if (lines[1]) assert.ok(/^      /.test(lines[1])); // hanging under "NOTE: "
  });

  test('block admonition [NOTE] + ==== fences kept', () => {
    const input = `[NOTE]\n====\nThis is a block admonition and should be kept as-is.\n====\n`;
    const { reflowTextAdoc } = require('../core');
    const out = reflowTextAdoc(input, 50);
    assert.strictEqual(out, input);
  });
});

describe('Blocks & fences', () => {
  test('[source,lang] + ---- code block preserved', () => {
    const input = `[source,python]\n----\nprint("hello")\n----\n`;
    const out = fmt(input, 50);
    assert.strictEqual(out, input);
  });

  test('table fences |=== kept', () => {
    const input = `|===\na| cell 1\n| cell 2\n|===\n`;
    const out = fmt(input, 20);
    assert.strictEqual(out, input);
  });

  test('quote/code fences & open blocks kept', () => {
    const input = `____\nQuote\n____\n----\ncode\n----\n--\nOpen block\n--\n`;
    const out = fmt(input, 20);
    assert.strictEqual(out, input);
  });

  test('HR and page break kept', () => {
    const input = `Before\n'''\n<<<\nAfter\n`;
    const out = fmt(input, 20);
    assert.strictEqual(out, input);
  });
});

describe('Structural lines', () => {
  test('anchors, conditionals, includes, block macros, block titles/attrs', () => {
    const input = `[[id,Ref]]\nifdef::env-doc[]\ninclude::path/to/file.adoc[leveloffset=+1]\nimage::img.png[Alt]\nindexterm:[Term]\ntoc::[]\n\n.Block Title\n[quote, Author]\nParagraph follows and must not merge upward.\n`;
    const out = fmt(input, 60);
    [
      '[[id,Ref]]',
      'ifdef::env-doc[]',
      'include::path/to/file.adoc[leveloffset=+1]',
      'image::img.png[Alt]',
      'indexterm:[Term]',
      'toc::[]',
      '.Block Title',
      '[quote, Author]'
    ].forEach(s => assert.ok(out.includes(s)));
    assert.ok(out.includes('Paragraph follows'));
  });
});

describe('Comments (critical)', () => {
  test('line comments // pass-through', () => {
    const input = `// standalone comment\nNext paragraph will wrap nicely to the width we specify in tests.\n`;
    const out = fmt(input, 45);
    assert.ok(out.startsWith('// standalone comment'));
  });

  test('block comments //// ... //// kept verbatim', () => {
    const input = `////\nignore me\n////\nParagraph wraps after the comment block and is not merged.\n`;
    const out = fmt(input, 35);
    assert.ok(out.includes('////\nignore me\n////'));
    assert.ok(out.includes('Paragraph wraps'));
  });
});

describe('False-positive list guard', () => {
  test('Uppercase initial "M." in a name is NOT a lettered list', () => {
    const input = `Academician *V.\nM. Glushkov*: “Information is a measure of the non-uniformity of the distribution of energy or matter in space and time; any non-uniformity carries some information with it.”\n`;
    const out = reflowTextAdoc(input, 72);
    const lines = out.split(/\\r?\\n/);
    const bad = lines.find(l => /^   (distribution|carries)/.test(l));
    if (bad) {
      throw new Error(`Detected unwanted hanging indent on: ${JSON.stringify(bad)}`);
    }
  });
});
