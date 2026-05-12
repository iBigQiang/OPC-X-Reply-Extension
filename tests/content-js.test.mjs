import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../content.js", import.meta.url), "utf8");

function functionBlock(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = source.indexOf("\n  function ", start + 1);
  const nextAsync = source.indexOf("\n  async function ", start + 1);
  const candidates = [next, nextAsync].filter((index) => index !== -1);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

function asyncFunctionBlock(name) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `missing async function ${name}`);
  const next = source.indexOf("\n  function ", start + 1);
  const nextAsync = source.indexOf("\n  async function ", start + 1);
  const candidates = [next, nextAsync].filter((index) => index !== -1);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

test("textbox selection prefers the visible X dialog over page textboxes", () => {
  const block = functionBlock("getBestTextbox");
  const dialogIndex = block.indexOf("const dialogBoxes = getDialogTextboxes();");
  const pageActiveIndex = block.indexOf("!active.closest?.('.akiii-draft-panel')");

  assert.match(source, /function getDialogTextboxes\(\)/);
  assert.match(block, /active\.closest\?\.\('div\[role="dialog"\]'\)/);
  assert.ok(dialogIndex !== -1, "dialog textbox lookup is missing");
  assert.ok(pageActiveIndex !== -1, "page textbox fallback is missing");
  assert.ok(dialogIndex < pageActiveIndex, "dialog textbox should be checked before page fallback");
});

test("insert action targets the dialog textbox and the cached editor when both are visible", () => {
  const targets = asyncFunctionBlock("getInsertTargets");
  const clickHandlerStart = source.indexOf("insertBtn.addEventListener('click'");
  assert.notEqual(clickHandlerStart, -1, "missing insert click handler");
  const clickHandler = source.slice(clickHandlerStart, source.indexOf("      });", clickHandlerStart) + 10);

  assert.match(targets, /const dialogBoxes = getDialogTextboxes\(\);/);
  assert.match(targets, /add\(dialogBoxes\.at\(-1\)\);/);
  assert.match(targets, /add\(preferredEditor\);/);
  assert.match(clickHandler, /const targets = await getInsertTargets\(editor,\s*2500\);/);
  assert.match(clickHandler, /for \(const target of targets\)/);
});
