
/**
 * AsciiDoc Reflow core — pure logic (no VS Code APIs)
 * Portions of this software were authored with the assistance of GPT-5 Thinking.
 * The author reviewed, tested, and accepted all changes.
 *
 * Exports:
 *   - reflowTextAdoc(input: string, width: number): string
 *
 * Safety rules (summary):
 * - Inside fences, open blocks, tables, or comment blocks → pass-through.
 * - Structural single-line markers (anchors, includes, conditionals, block macros, etc.) break paragraphs.
 * - Paragraphs that begin with a leading space are literal → preserved verbatim until a blank line.
 * - Single-line admonitions (NOTE:/TIP:/...) wrap with a hanging indent.
 * - Lists: simple items are wrapped with hanging indents; nested/continued/indented-code items are kept as-is.
 */

// ------------------ Patterns / Delimiters ------------------
const FENCE_RE = /^([._=*+\-]{4,})\s*$/;      // ----, ...., ====, ****, ++++, ____
const OPEN_BLOCK_RE = /^--\s*$/;              // Open block -- ... --
const TITLE_RE = /^=+\s/;                     // "= Title", "== Subtitle", ...
const ATTR_RE  = /^:[^:\s][^:]*:\s?.*$/;      // ":attr: value"
const BLOCK_TITLE_RE = /^\.[^\s].*$/;         // ".Block title"
const BLOCK_ATTR_RE  = /^\[[^\]]+\]\s*$/;     // [quote, Author], [role=lead], etc.
const ANCHOR_RE = /^\s*\[\[[^\]]+\]\]\s*$/;   // [[id]] or [[id,ref]]

const CONDITIONAL_RE = /^(ifdef|ifndef|ifeval|endif)::.*$/;
const INCLUDE_RE     = /^include::\S+\[.*\]\s*$/;

// Block macro lines on their own (image::, plantuml::, toc::[], indexterm:[...])
const BLOCK_MACRO_RE = /^[a-z][\w+-]*:(?::)?(?:\S+)?\[[^\]]*\]\s*$/i;

const TABLE_FENCE_RE = /^\|===\s*$/;

const COMMENT_BLOCK_FENCE_RE = /^\/\/\/\/\s*$/; // "////" toggles comment block
const LINE_COMMENT_RE = /^\s*\/\/(?!\/\/)\s?.*$/; // line comment, but not "////"

// Bullets may repeat to signal depth: '*', '**', '***', also '+'/'-'.
// Numbered '1.' and lowercase lettered 'a.' supported. Exclude uppercase lettered to avoid initials like "M. Glushkov".
const LIST_RE = /^([ \t]*)(\*{1,6}|\+{1,6}|\-{1,6}|[0-9]+\.|[a-z]\.|•)\s+(.*)$/;
const DEF_LIST_RE = /^([ \t]*)([^:]+)::\s*(.*)$/;
const CONTINUATION_LINE_RE = /^[ \t]*\+[ \t]*$/;

const INDENTED_CODE_RE = /^(\t| {4,})/;

const ADMON_SINGLE_RE = /^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\s*(.*)$/;

const HR_RE   = /^'{3,}\s*$/;  // ''' thematic rule
const PAGE_RE = /^<<<\s*$/;    // page break

const URL_TOKEN_RE = /^[a-z]+:\/\/\S+$/i;

// Literal paragraph: first non-blank line begins with a leading space
const LEADING_SPACE_LINE_RE = /^ [^\s].*$/;

// Marker depth helper: repeated bullets ⇒ depth; ordered/lettered ⇒ depth 1
function markerDepth(m) {
  if (!m) return 0;
  if (/^\*+$/.test(m) || /^\++$/.test(m) || /^\-+$/.test(m)) return m.length;
  if (/^[0-9]+\.$/.test(m)) return 1;
  if (/^[a-z]\.$/.test(m)) return 1;
  if (m === "•") return 1;
  return 0;
}

// ------------------ Wrapping helpers ------------------
function wrapText(text, width, hangingPrefix = "") {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const isUrl = URL_TOKEN_RE.test(w);
    if (!isUrl && w.length >= width) {
      // Hard-split long non-URL tokens
      if (line) { lines.push(line); line = ""; }
      let s = w;
      while (s.length > width) { lines.push(s.slice(0, width)); s = s.slice(width); }
      line = s;
      continue;
    }
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > width) {
      // Prefer to keep very short last word (<=2) with the next line
      if (line) {
        const parts = line.split(" ");
        const last = parts[parts.length - 1] || "";
        if (last.length <= 2 && parts.length > 1) {
          parts.pop();
          lines.push(parts.join(" "));
          line = last + " " + w;
          continue;
        }
      }
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : hangingPrefix + l)).join("\n");
}

function reflowParagraph(lines, width) {
  if (!lines.length) return [];

  // List item with hanging indent
  const mList = lines[0].match(LIST_RE);
  if (mList) {
    const indent = mList[1] ?? "";
    const marker = mList[2];
    let rest0  = mList[3] ?? "";

    // Detect checklist prefix immediately after the list marker: [ ], [x], [X], [-]
    let checklist = "";
    const mChk = rest0.match(/^\[(?: |x|X|-)\]\s+/);
    if (mChk) {
      checklist = mChk[0];               // includes trailing space
      rest0 = rest0.slice(checklist.length);
    }

    const head = indent + marker + " " + checklist; // e.g. "* [x] "
    const hangingLen = Math.max(head.length, checklist ? 8 : head.length);
    const hanging = " ".repeat(hangingLen);
    const body = [rest0, ...lines.slice(1).map(l => l.trim())]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const wrapped = wrapText(body, Math.max(20, width - hangingLen), hanging);
    return [head + wrapped];
  }

  // Definition list item with hanging indent after "Term:: "
  const mDef = lines[0].match(DEF_LIST_RE);
  if (mDef) {
    const indent = mDef[1] ?? "";
    const term   = mDef[2].trim();
    const rest0  = mDef[3] ?? "";
    const head   = `${indent}${term}:: `;
    const hanging = " ".repeat(head.length);
    const joined = [rest0, ...lines.slice(1).map(l => l.trim())].join(" ").replace(/\s+/g, " ").trim();
    const wrapped = wrapText(joined, Math.max(20, width - hanging.length), hanging);
    return [head + wrapped];
  }

  // Respect hard line breaks (trailing " +")
  if (lines.some(l => /\s\+$/.test(l))) return lines;

  // Normal paragraph
  const joined = lines.map(l => l.trim()).join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return [""];
  return wrapText(joined, width).split("\n");
}

// Collect a single list/def-list item; mark complex cases (nested lists, continuation '+', indented code)
function collectListItem(srcLines, i) {
  const first = srcLines[i];
  const mTop = first.match(LIST_RE) || first.match(DEF_LIST_RE);
  if (!mTop) return { lines: [first], next: i + 1, complex: false };

  const topIndent = (mTop[1] ?? "").length;
  const topMarker = mTop[2] || "";
  const topDepth  = markerDepth(topMarker);

  const lines = [first];
  let j = i + 1;
  let complex = false;

  while (j < srcLines.length) {
    const line = srcLines[j];
    const t = line.trim();

    // Structural boundaries / starts
    if (/^\s*$/.test(line)) break;
    if (COMMENT_BLOCK_FENCE_RE.test(t)) break;
    if (TABLE_FENCE_RE.test(t)) break;
    if (FENCE_RE.test(t) || OPEN_BLOCK_RE.test(t)) break;
    if (HR_RE.test(t) || PAGE_RE.test(t)) break;
    if (TITLE_RE.test(line) || ATTR_RE.test(line) || BLOCK_TITLE_RE.test(line) || BLOCK_ATTR_RE.test(line) ||
        ANCHOR_RE.test(line) || CONDITIONAL_RE.test(line) || INCLUDE_RE.test(line) || BLOCK_MACRO_RE.test(line)) break;

    if (CONTINUATION_LINE_RE.test(line)) { complex = true; lines.push(line); j++; break; }

    const mList = line.match(LIST_RE);
    const mDef  = line.match(DEF_LIST_RE);
    if (mList || mDef) {
      const indent = (mList ? mList[1] : mDef[1]) ?? "";
      // nested if indent grows OR same indent with deeper marker (e.g., '*' → '**')
      if (indent.length <= topIndent && mList) {
        const d = markerDepth(mList[2] || "");
        if (d <= topDepth) break; // sibling/parent → stop
      } else if (indent.length <= topIndent && mDef) {
        break;
      }
      complex = true; lines.push(line); j++; continue; // nested → keep as-is
    }

    if (INDENTED_CODE_RE.test(line)) { complex = true; lines.push(line); j++; continue; }

    lines.push(line); j++;
  }

  return { lines, next: j, complex };
}

// Main reflow
function reflowTextAdoc(input, width) {
  const out = [];
  let para = [];
  let inFence = false;
  let inOpen = false;
  let inTable = false;
  let inCommentBlock = false;
  let inLiteralPara = false;          // paragraph that started with leading space
  const endsWithNL = /\r?\n$/.test(input);

  const flush = () => {
    if (!para.length) return;
    out.push(...reflowParagraph(para, width));
    para = [];
  };

  const src = input.split(/\r?\n/);
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    const t = line.trim();

    // Comment block toggle
    if (COMMENT_BLOCK_FENCE_RE.test(t)) { flush(); out.push(line); inCommentBlock = !inCommentBlock; continue; }
    if (inCommentBlock) { out.push(line); continue; }

    // Single-line comment
    if (LINE_COMMENT_RE.test(line)) { flush(); out.push(line); continue; }

    // Structural single-line boundaries
    if (BLOCK_TITLE_RE.test(line) || BLOCK_ATTR_RE.test(line) ||
        ANCHOR_RE.test(line) || CONDITIONAL_RE.test(line) ||
        INCLUDE_RE.test(line) || BLOCK_MACRO_RE.test(line) ||
        HR_RE.test(t) || PAGE_RE.test(t)) {
      flush(); out.push(line); continue;
    }

    // Table fences
    if (TABLE_FENCE_RE.test(t)) { flush(); out.push(line); inTable = !inTable; continue; }
    if (inTable) { out.push(line); continue; }

    // Fences & open blocks
    if (FENCE_RE.test(t)) { flush(); out.push(line); inFence = !inFence; continue; }
    if (OPEN_BLOCK_RE.test(t)) { flush(); out.push(line); inOpen = !inOpen; continue; }

    // Blank line → end paragraph (normal or literal)
    if (/^\s*$/.test(line)) {
      const isLast = (i === src.length - 1);
      if (inLiteralPara) inLiteralPara = false;
      flush();
      if (!(isLast && line === "")) {
        out.push("");
      }
      continue;
    }

    // Non-reflowable contexts and lines
    if (inFence || inOpen || TITLE_RE.test(line) || ATTR_RE.test(line)) { flush(); out.push(line); continue; }

    // Literal paragraph (first non-blank line begins with a space)
    if (!para.length && !inLiteralPara && LEADING_SPACE_LINE_RE.test(line)) {
      flush(); inLiteralPara = true; out.push(line); continue;
    }
    if (inLiteralPara) { out.push(line); continue; }

    // Single-line admonition with hanging indent
    const mAd = line.match(ADMON_SINGLE_RE);
    if (mAd) {
      flush();
      const label = mAd[1];
      const body  = mAd[2] || "";
      const prefix = `${label}: `;
      const hanging = " ".repeat(prefix.length);
      const wrapped = body
        ? prefix + wrapText(body.trim(), Math.max(20, width - hanging.length), hanging)
        : prefix;
      out.push(wrapped);
      continue;
    }

    // Lists and definition lists: collect complete item
    if (LIST_RE.test(line) || DEF_LIST_RE.test(line)) {
      flush();
      const { lines, next, complex } = collectListItem(src, i);
      if (complex) out.push(...lines); else out.push(...reflowParagraph(lines, width));
      i = next - 1;
      continue;
    }

    // Indented code line (defensive)
    if (INDENTED_CODE_RE.test(line)) { flush(); out.push(line); continue; }

    // Normal paragraph line → accumulate
    para.push(line);
  }
  flush();
  return out.join("\n") + (endsWithNL ? "\n" : "");
}

module.exports = { reflowTextAdoc };
