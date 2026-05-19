import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../options.html", import.meta.url), "utf8");
const js = fs.readFileSync(new URL("../options.js", import.meta.url), "utf8");

// API Key 输入框右端的密码可见性切换按钮（v2.1.2）
// 默认必须仍是 type="password"，绝对不能因为加切换控件就退化安全默认。

test("API Key input 默认仍是 type=\"password\"，不会因切换控件退化", () => {
  const m = html.match(/<input\s+id="apiKey"[^>]*>/);
  assert.ok(m, "找不到 <input id=\"apiKey\">");
  assert.match(m[0], /type="password"/);
  assert.match(m[0], /autocomplete="off"/);
});

test("API Key input 被 .input-with-toggle wrapper 包裹，切换按钮紧跟其后", () => {
  const wrapper = html.match(/<div\s+class="input-with-toggle">([\s\S]*?)<\/div>/);
  assert.ok(wrapper, "找不到 .input-with-toggle wrapper");
  const inner = wrapper[1];
  assert.match(inner, /<input\s+id="apiKey"/, "wrapper 必须包住 #apiKey");
  assert.match(inner, /<button[^>]*id="apiKeyToggle"/, "wrapper 内必须有 #apiKeyToggle 按钮");
});

test("切换按钮带正确 a11y 属性：type=button + aria-pressed=false + aria-label", () => {
  const btn = html.match(/<button[^>]*id="apiKeyToggle"[^>]*>/);
  assert.ok(btn, "找不到 #apiKeyToggle 按钮");
  assert.match(btn[0], /type="button"/, "必须 type=button 防止误提交表单");
  assert.match(btn[0], /aria-pressed="false"/, "初始 aria-pressed 必须为 false");
  assert.match(btn[0], /aria-label="显示 API Key"/, "初始 aria-label 必须是「显示 API Key」");
});

test("CSS 段有 .input-with-toggle 与 .visibility-toggle 规则，按 aria-pressed 切 SVG", () => {
  assert.match(html, /\.input-with-toggle\s*\{[^}]*position:\s*relative/);
  assert.match(html, /\.input-with-toggle\s*>\s*input\s*\{[^}]*padding-right:\s*44px/);
  assert.match(html, /\.visibility-toggle\s*\{[^}]*position:\s*absolute/);
  assert.match(html, /\.visibility-toggle\[aria-pressed="true"\]\s*\.eye-open\s*\{[^}]*display:\s*none/);
  assert.match(html, /\.visibility-toggle\[aria-pressed="true"\]\s*\.eye-off\s*\{[^}]*display:\s*block/);
});

test("options.js 绑定 #apiKeyToggle click：切 password ↔ text + 同步 aria-pressed/aria-label", () => {
  assert.match(js, /\$\("apiKeyToggle"\)\.addEventListener\("click"/);
  assert.match(js, /input\.type\s*===\s*"password"/);
  assert.match(js, /willShow\s*\?\s*"text"\s*:\s*"password"/);
  assert.match(js, /setAttribute\("aria-pressed"/);
  assert.match(js, /setAttribute\("aria-label"/);
});
