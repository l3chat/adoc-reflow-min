
# Changelog

## 0.0.2
- Fix: avoid false-positive uppercase lettered lists (“M. Glushkov”).
- Fix: idempotent trailing blank lines at EOF.
- Lists: support nested markers (`**`, `***`, etc.) and preserve nested items.
- Checklists: ensure hanging indent is at least 8 spaces for readability.
- Wrapping: avoid breaking before very short words (<= 2 chars).

## 0.0.1
- Initial release: paragraph reflow, lists/def-lists (incl. checklists), admonitions (single-line and block form keep fences),
  comments (// and ////), tables, fences (----, ...., ====, ****, ++++, ____), open block (--), anchors, includes,
  conditionals, block macros (including `toc::[]` and `indexterm:[...]`), HR ('''), page break (<<<),
  literal paragraphs (leading space), and `[source,lang]` + code fences preserved.

- Portions of this software were authored with the assistance of GPT-5 Thinking. The author reviewed, tested, and accepted all changes.
