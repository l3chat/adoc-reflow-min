
# AsciiDoc Reflow (Minimal)

> Portions of this software were authored with the assistance of **GPT-5 Thinking**. The author reviewed, tested, and accepted all changes.

A tiny VS Code formatter that **reflows paragraphs** in `.adoc` files while preserving
AsciiDoc structure (titles, attributes, comments, lists, admonitions, tables, fences,
open blocks, anchors, includes, macros, HR/page breaks, and **literal paragraphs with leading spaces**).

- Command: **AsciiDoc: Reflow Selection/Paragraph**
- Command: **AsciiDoc: Reflow Entire Document**
- Works with **Format Document** / **Format Selection**.
- Setting: `adocReflow.wrapColumn` (default 80).

## Install locally
- Open this folder in VS Code and press **F5** (Extension Development Host), or
- Package with `vsce package` and “Install from VSIX…”, or
- Copy the folder to your VS Code extensions directory.

## Tests
- Unit tests: `npm test` (fast, API-level)
- Golden corpus (file-based): `npm run test:corpus`
- All tests: `npm run test:all`
