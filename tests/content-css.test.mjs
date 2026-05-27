import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../content.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing rule ${selector}`);
  return match[1];
}

test("candidate action buttons use one compact shared width", () => {
  assert.match(rule(".akiii-draft-panel"), /--akiii-action-button-width:\s*84px;/);
  assert.match(rule(".akiii-draft-panel"), /box-sizing:\s*border-box;/);
  assert.match(rule(".akiii-draft-panel"), /isolation:\s*isolate;/);
  assert.match(rule(".akiii-draft-panel"), /width:\s*min\(600px,\s*calc\(100vw - 24px\)\);/);
  assert.match(rule(".akiii-draft-panel"), /height:\s*min\(600px,\s*60dvh\);/);
  assert.match(rule(".akiii-draft-panel"), /max-height:\s*min\(600px,\s*60dvh\);/);
  assert.match(rule(".akiii-draft-panel"), /overflow:\s*hidden;/);
  assert.match(rule(".akiii-draft-candidate-body"), /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+max-content;/);
  assert.match(rule(".akiii-draft-candidate-body"), /gap:\s*12px;/);

  const text = rule(".akiii-draft-text");
  assert.match(text, /box-sizing:\s*border-box;/);
  assert.match(text, /min-width:\s*0;/);
  assert.match(text, /max-width:\s*none;/);
  assert.match(text, /justify-self:\s*stretch;/);
  assert.match(text, /height:\s*clamp\(84px,\s*10dvh,\s*96px\);/);
  assert.match(text, /max-height:\s*104px;/);
  assert.match(text, /resize:\s*none;/);
  assert.match(text, /overflow:\s*auto;/);
  assert.match(text, /overflow-wrap:\s*anywhere;/);
  assert.match(text, /font:\s*500\s+clamp\(14px,\s*\.9vw,\s*15px\)\/1\.38/);
  assert.doesNotMatch(text, /(?:760|820|950)/);

  const actions = rule(".akiii-draft-candidate-actions");
  assert.match(actions, /justify-self:\s*end;/);
  assert.doesNotMatch(actions, /(?:^|\s)width:\s*\d+px;/);

  const buttons = rule(".akiii-draft-candidate-actions button");
  assert.match(buttons, /width:\s*var\(--akiii-action-button-width\);/);
  assert.match(buttons, /padding:\s*6px\s+0;/);
  assert.match(buttons, /min-height:\s*32px;/);
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

test("详情页元信息行里的 AI回 使用更紧凑的内联样式，时间线按钮不受影响", () => {
  const article = rule(".akiii-article");
  assert.match(article, /align-self:\s*center;/);
  assert.match(article, /height:\s*30px;/);
  assert.match(article, /margin:\s*0\s+0\s+0\s+8px;/);

  const group = rule("[role=\"group\"] > .akiii-ai-button.akiii-article");
  assert.match(group, /margin-top:\s*auto;/);
  assert.match(group, /margin-bottom:\s*auto;/);

  const meta = rule(".akiii-ai-button.akiii-detail-meta");
  assert.match(meta, /height:\s*21px;/);
  assert.match(meta, /min-width:\s*44px;/);
  assert.match(meta, /margin-left:\s*8px;/);
  assert.match(meta, /font:\s*650\s+11\.5px\/1/);
  assert.doesNotMatch(meta, /950/);
  assert.match(meta, /vertical-align:\s*middle;/);
});

test("草稿窗右上角关闭按钮的 × 必须居中（修复 × 偏上偏左 bug）", () => {
  const close = rule(".akiii-draft-close");
  assert.match(close, /position:\s*relative;/);
  assert.match(close, /display:\s*inline-grid;/);
  assert.match(close, /place-items:\s*center;/);
  assert.match(close, /padding:\s*0;/);
  assert.match(close, /width:\s*38px;/);
  assert.match(close, /height:\s*38px;/);
  assert.match(close, /font-size:\s*0;/);
  assert.match(rule(".akiii-draft-close::before"), /transform:\s*translate\(-50%,\s*-50%\)\s*rotate\(45deg\);/);
  assert.match(rule(".akiii-draft-close::after"), /transform:\s*translate\(-50%,\s*-50%\)\s*rotate\(-45deg\);/);
});

test("草稿窗头部头像与标题文字块保持垂直对齐", () => {
  assert.match(rule(".akiii-draft-head"), /align-items:\s*center;/);
  assert.match(rule(".akiii-draft-logo"), /width:\s*54px;/);
  assert.match(rule(".akiii-draft-logo"), /height:\s*54px;/);
  assert.match(rule(".akiii-draft-title"), /margin-top:\s*0;/);
});

test("草稿窗按钮和关闭按钮都有键盘焦点态", () => {
  assert.match(rule(".akiii-draft-close:focus-visible"), /outline:\s*3px\s+solid/);
  assert.match(rule(".akiii-draft-candidate-actions button:focus-visible"), /outline:\s*3px\s+solid/);
});
