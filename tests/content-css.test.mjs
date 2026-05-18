import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../content.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replaceAll(".", "\\.");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing rule ${selector}`);
  return match[1];
}

test("candidate action buttons use one compact shared width", () => {
  assert.match(rule(".akiii-draft-panel"), /--akiii-action-button-width:\s*72px;/);
  assert.match(rule(".akiii-draft-candidate-body"), /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+max-content;/);
  assert.match(rule(".akiii-draft-candidate-body"), /gap:\s*16px;/);

  const text = rule(".akiii-draft-text");
  assert.match(text, /box-sizing:\s*border-box;/);
  assert.match(text, /min-width:\s*0;/);
  assert.match(text, /max-width:\s*500px;/);
  assert.match(text, /justify-self:\s*start;/);
  assert.match(text, /overflow-wrap:\s*anywhere;/);

  const actions = rule(".akiii-draft-candidate-actions");
  assert.match(actions, /justify-self:\s*end;/);
  assert.doesNotMatch(actions, /(?:^|\s)width:\s*\d+px;/);

  const buttons = rule(".akiii-draft-candidate-actions button");
  assert.match(buttons, /width:\s*var\(--akiii-action-button-width\);/);
  assert.match(buttons, /padding:\s*5px\s+0;/);
  assert.match(buttons, /display:\s*inline-flex;/);
  assert.match(buttons, /justify-content:\s*center;/);
  assert.doesNotMatch(rule(".akiii-draft-copy"), /(?:^|\s)width:\s*\d+px;/);
  assert.doesNotMatch(rule(".akiii-draft-insert"), /(?:^|\s)width:\s*\d+px;/);
});

test("AI 按钮文字水平和垂直都居中（修复评论框 / 弹窗内 AI填入文字左偏 bug）", () => {
  const aiBtn = rule(".akiii-ai-button");
  assert.match(aiBtn, /display:\s*inline-flex;/);
  assert.match(aiBtn, /align-items:\s*center;/);
  assert.match(aiBtn, /justify-content:\s*center;/);
});

test("草稿窗右上角关闭按钮的 × 必须居中（修复 × 偏上偏左 bug）", () => {
  const close = rule(".akiii-draft-close");
  assert.match(close, /display:\s*inline-grid;/);
  assert.match(close, /place-items:\s*center;/);
  assert.match(close, /padding:\s*0;/);
});
