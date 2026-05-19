import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// 从 options.js 抽 buildEndpointPreview 纯函数，避免在 vm 里跑整段（会被 chrome / document mock 拖累）。
// 函数本身不依赖 DOM，可以直接 new Function 包出来用。
const source = fs.readFileSync(new URL("../options.js", import.meta.url), "utf8");
const match = source.match(/function buildEndpointPreview[\s\S]*?\n\}/);
assert.ok(match, "options.js 里找不到 buildEndpointPreview 函数");
const buildEndpointPreview = new Function(`${match[0]}; return buildEndpointPreview;`)();

test("openai_chat / newapi / sub2api / api2d 都拼出 /chat/completions", () => {
  assert.equal(
    buildEndpointPreview("openai_chat", "https://api.openai.com/v1", "gpt-4.1-mini"),
    "https://api.openai.com/v1/chat/completions"
  );
  assert.equal(
    buildEndpointPreview("newapi", "https://newapi.hitu.me/v1", "gpt-4.1-mini"),
    "https://newapi.hitu.me/v1/chat/completions"
  );
  assert.equal(
    buildEndpointPreview("sub2api", "https://demo.sub2api.org/v1", ""),
    "https://demo.sub2api.org/v1/chat/completions"
  );
  assert.equal(
    buildEndpointPreview("api2d", "https://oa.api2d.net/v1", "gpt-4o-mini"),
    "https://oa.api2d.net/v1/chat/completions"
  );
});

test("openai_responses 拼出 /responses", () => {
  assert.equal(
    buildEndpointPreview("openai_responses", "https://api.openai.com/v1", "gpt-4.1-mini"),
    "https://api.openai.com/v1/responses"
  );
});

test("anthropic 拼出 /v1/messages，支持 DeepSeek 兼容入口", () => {
  assert.equal(
    buildEndpointPreview("anthropic", "https://api.anthropic.com", "claude-sonnet-4-5"),
    "https://api.anthropic.com/v1/messages"
  );
  assert.equal(
    buildEndpointPreview("anthropic", "https://api.deepseek.com/anthropic", "deepseek-v4-pro"),
    "https://api.deepseek.com/anthropic/v1/messages"
  );
});

test("gemini 把 model 放进路径，空 model 时显示 {model} 占位符", () => {
  assert.equal(
    buildEndpointPreview("gemini", "https://generativelanguage.googleapis.com/v1beta", "gemini-2.0-flash"),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
  );
  assert.equal(
    buildEndpointPreview("gemini", "https://generativelanguage.googleapis.com/v1beta", ""),
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
  );
});

test("末尾 / 会被 normalize 掉，不会出现 //chat/completions", () => {
  assert.equal(
    buildEndpointPreview("openai_chat", "https://api.openai.com/v1/", ""),
    "https://api.openai.com/v1/chat/completions"
  );
  assert.equal(
    buildEndpointPreview("openai_chat", "https://api.openai.com/v1///", ""),
    "https://api.openai.com/v1/chat/completions"
  );
});

test("custom 渠道直接显示用户填的完整 endpoint，不附加任何后缀", () => {
  assert.equal(
    buildEndpointPreview("custom", "https://api.example.com/openai/v1/chat/completions", ""),
    "https://api.example.com/openai/v1/chat/completions"
  );
});

test("custom 渠道 base 为空时给出占位提示，避免预览成 'undefined' 之类", () => {
  const preview = buildEndpointPreview("custom", "", "");
  assert.match(preview, /自定义|完整 endpoint/);
});

test("未知 provider 走 openai chat 路径作为兜底，避免预览空白", () => {
  assert.equal(
    buildEndpointPreview("nope_provider", "https://example.com/v1", ""),
    "https://example.com/v1/chat/completions"
  );
});

// v2.1.3 — Cherry Studio 风的自动补全归一化：用户填啥粒度都能拼对
test("openai_chat 根域名自动补 /v1/chat/completions", () => {
  assert.equal(
    buildEndpointPreview("openai_chat", "https://api.deepseek.com", ""),
    "https://api.deepseek.com/v1/chat/completions"
  );
  assert.equal(
    buildEndpointPreview("openai_chat", "https://api.deepseek.com/", ""),
    "https://api.deepseek.com/v1/chat/completions"
  );
});

test("openai_chat 用户填完整 endpoint URL 透传", () => {
  assert.equal(
    buildEndpointPreview("openai_chat", "https://api.deepseek.com/v1/chat/completions", ""),
    "https://api.deepseek.com/v1/chat/completions"
  );
  // 大小写不敏感
  assert.equal(
    buildEndpointPreview("openai_chat", "https://api.deepseek.com/v1/Chat/Completions", ""),
    "https://api.deepseek.com/v1/Chat/Completions"
  );
});

test("openai_responses 根域名补全为 /v1/responses", () => {
  assert.equal(
    buildEndpointPreview("openai_responses", "https://newapi.hitu.me", ""),
    "https://newapi.hitu.me/v1/responses"
  );
});

test("anthropic 用户填带 /v1 不重复 v1", () => {
  assert.equal(
    buildEndpointPreview("anthropic", "https://api.deepseek.com/anthropic/v1", ""),
    "https://api.deepseek.com/anthropic/v1/messages"
  );
  assert.equal(
    buildEndpointPreview("anthropic", "https://api.deepseek.com/anthropic/v1/", ""),
    "https://api.deepseek.com/anthropic/v1/messages"
  );
});

test("anthropic 用户填完整 endpoint URL 透传", () => {
  assert.equal(
    buildEndpointPreview("anthropic", "https://api.deepseek.com/anthropic/v1/messages", ""),
    "https://api.deepseek.com/anthropic/v1/messages"
  );
});

test("gemini 根域名自动补 /v1beta/models/.../generateContent", () => {
  assert.equal(
    buildEndpointPreview("gemini", "https://generativelanguage.googleapis.com", "gemini-2.0-flash"),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
  );
});

test("gemini 用户填完整 endpoint URL（含 model）透传", () => {
  assert.equal(
    buildEndpointPreview("gemini", "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent", "gemini-2.0-flash"),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"
  );
});

test("newapi / sub2api 根域名自动补 /v1/chat/completions", () => {
  assert.equal(
    buildEndpointPreview("newapi", "https://newapi.hitu.me", ""),
    "https://newapi.hitu.me/v1/chat/completions"
  );
  assert.equal(
    buildEndpointPreview("sub2api", "https://demo.sub2api.org", ""),
    "https://demo.sub2api.org/v1/chat/completions"
  );
});

test("# 终止符强制透传：跨 provider 都生效", () => {
  // openai_chat 走 Azure 风格自定义路径
  assert.equal(
    buildEndpointPreview("openai_chat", "https://my.proxy/openai/deployments/X/chat/completions#", ""),
    "https://my.proxy/openai/deployments/X/chat/completions"
  );
  // anthropic 自定义路径
  assert.equal(
    buildEndpointPreview("anthropic", "https://my.proxy/anthropic/special/messages#", ""),
    "https://my.proxy/anthropic/special/messages"
  );
  // # 后面还有末尾 / 也得去掉
  assert.equal(
    buildEndpointPreview("openai_chat", "https://my.proxy/abs/#", ""),
    "https://my.proxy/abs"
  );
});

test("/v1$ 边界匹配不会误判 /v1beta（gemini 不会被走成 openai chat 风格）", () => {
  // gemini 渠道下，/v1beta 应被识别为已带 versionSeg，不再追加
  assert.equal(
    buildEndpointPreview("gemini", "https://generativelanguage.googleapis.com/v1beta", "gemini-2.0-flash"),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
  );
});

test("base 为空时给占位提示，不拼出畸形 /chat/completions", () => {
  const preview = buildEndpointPreview("openai_chat", "", "");
  assert.equal(preview, "—");
});
