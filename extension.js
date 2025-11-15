
/**
 * VS Code glue for AsciiDoc Reflow (Minimal)
 * Portions of this software were authored with the assistance of GPT-5 Thinking.
 * The author reviewed, tested, and accepted all changes.
 */
const vscode = require("vscode");
const { reflowTextAdoc } = require("./core");

function fullDocumentRange(document) {
  if (document.lineCount === 0) return new vscode.Range(0, 0, 0, 0);
  const last = document.lineCount - 1;
  const lastLen = document.lineAt(last).text.length;
  return new vscode.Range(0, 0, last, lastLen);
}

function paragraphRangeAt(document, line) {
  const last = Math.max(0, document.lineCount - 1);
  let s = Math.max(0, Math.min(line, last));
  let e = s;
  while (s > 0 && !/^\s*$/.test(document.lineAt(s - 1).text)) s--;
  while (e < last && !/^\s*$/.test(document.lineAt(e + 1).text)) e++;
  const endChar = document.lineAt(e).text.length;
  return new vscode.Range(s, 0, e, endChar);
}

function getWrapColumn() {
  const cfg = vscode.workspace.getConfiguration("adocReflow");
  const col = cfg.get("wrapColumn", 80);
  return Math.max(20, Math.min(200, col));
}

function activate(context) {
  // Command: reflow selection / current paragraph
  const reflowSelection = vscode.commands.registerCommand("adocReflow.reflowSelection", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const { document, selections } = editor;
    const width = getWrapColumn();
    await editor.edit(edit => {
      selections.forEach(sel => {
        const range = sel.isEmpty ? paragraphRangeAt(document, sel.start.line) : sel;
        const out = reflowTextAdoc(document.getText(range), width);
        edit.replace(range, out);
      });
    });
  });

  // Command: reflow entire document
  const reflowDocument = vscode.commands.registerCommand("adocReflow.reflowDocument", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const { document } = editor;
    const width = getWrapColumn();
    const all = fullDocumentRange(document);
    const out = reflowTextAdoc(document.getText(all), width);
    await editor.edit(b => b.replace(all, out));
  });

  // “Format Document”
  const docProvider = vscode.languages.registerDocumentFormattingEditProvider("asciidoc", {
    provideDocumentFormattingEdits(document) {
      const width = getWrapColumn();
      const full = fullDocumentRange(document);
      const original = document.getText(full);
      const formatted = reflowTextAdoc(original, width);
      if (formatted === original) return [];
      return [vscode.TextEdit.replace(full, formatted)];
    }
  });

  // “Format Selection”
  const rangeProvider = vscode.languages.registerDocumentRangeFormattingEditProvider("asciidoc", {
    provideDocumentRangeFormattingEdits(document, range) {
      const width = getWrapColumn();
      const start = new vscode.Position(range.start.line, 0);
      const end = new vscode.Position(range.end.line, document.lineAt(range.end.line).text.length);
      const fullLinesRange = new vscode.Range(start, end);
      const original = document.getText(fullLinesRange);
      const formatted = reflowTextAdoc(original, width);
      if (formatted === original) return [];
      return [vscode.TextEdit.replace(fullLinesRange, formatted)];
    }
  });

  context.subscriptions.push(reflowSelection, reflowDocument, docProvider, rangeProvider);
}

function deactivate() {}

module.exports = { activate, deactivate };
