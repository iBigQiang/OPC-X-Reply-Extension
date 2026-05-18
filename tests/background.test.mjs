import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../background.js", import.meta.url), "utf8");

function loadBackground({ settings, fetchImpl }) {
  const listeners = {};
  const context = {
    console,
    TextDecoder,
    URL,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    chrome: {
      storage: {
        local: {
          get: async () => ({ ...settings }),
          set: async () => {}
        }
      },
      runtime: {
        onInstalled: { addListener: (fn) => { listeners.onInstalled = fn; } },
        onMessage: { addListener: (fn) => { listeners.onMessage = fn; } },
        openOptionsPage: async () => {}
      },
      action: {
        onClicked: { addListener: (fn) => { listeners.onClicked = fn; } }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "background.js" });
  return context;
}

function baseSettings(overrides = {}) {
  return {
    provider: "chat",
    apiKey: "sk-test",
    model: "gpt-5.5",
    apiBase: "https://sub2api.hitu.me",
    api2dBase: "https://oa.api2d.net/v1",
    defaultLanguage: "zh",
    defaultStyle: "sharp",
    maxChineseChars: 100,
    maxEnglishWords: 49,
    bannedWords: "",
    projectHandle: "",
    customPrompt: "",
    debugMode: false,
    ...overrides
  };
}

function providerSettings(provider, profileOverrides = {}, overrides = {}) {
  const defaults = {
    openai_chat:      { apiKey: "sk-chat",      model: "gpt-4.1-mini",      apiBase: "https://api.openai.com/v1" },
    openai_responses: { apiKey: "sk-resp",      model: "gpt-4.1-mini",      apiBase: "https://api.openai.com/v1" },
    gemini:           { apiKey: "AIzaSyTEST",   model: "gemini-2.0-flash",  apiBase: "https://generativelanguage.googleapis.com/v1beta" },
    anthropic:        { apiKey: "sk-ant-test",  model: "claude-sonnet-4-5", apiBase: "https://api.anthropic.com" },
    newapi:           { apiKey: "sk-newapi",    model: "gpt-4.1-mini",      apiBase: "https://newapi.hitu.me/v1" },
    sub2api:          { apiKey: "sk-sub",       model: "gpt-4.1-mini",      apiBase: "https://demo.sub2api.org/v1" },
    api2d:            { apiKey: "fk-test",      model: "gpt-4o-mini",       apiBase: "https://oa.api2d.net/v1" }
  };
  const profile = { ...defaults[provider], ...profileOverrides };
  return baseSettings({
    provider,
    apiKey: profile.apiKey,
    model: profile.model,
    apiBase: profile.apiBase,
    providerProfiles: {
      [provider]: profile
    },
    ...overrides
  });
}

function payload(overrides = {}) {
  return {
    tweetText: "AI 工具最大的价值不是替代人，而是把普通人的试错成本压低。",
    author: "Tester",
    authorHandle: "@tester",
    mentionedHandles: [],
    url: "https://x.com/tester/status/1",
    language: "zh",
    ...overrides
  };
}

test("Chat Completions 200 HTML response is treated as configuration error, not fallback text", async () => {
  const context = loadBackground({
    settings: baseSettings(),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => "<!doctype html><html><title>sub2api</title></html>",
      json: async () => { throw new Error("not json"); }
    })
  });

  await assert.rejects(
    () => context.generateReply(payload()),
    /返回的不是 JSON|Base URL|chat\/completions/
  );
});

test("generateReplies returns three cleaned candidates from a JSON array response", async () => {
  const context = loadBackground({
    settings: baseSettings({
      customPrompt: "更像真实评论区，短、狠、准；不要标题。"
    }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              "真正省下来的不是时间，是少走弯路的成本。",
              "很多人怕被替代，其实先被替代的是低质量重复。",
              "工具没变聪明，聪明的是会用工具的人。"
            ])
          }
        }]
      })
    })
  });

  assert.equal(typeof context.generateReplies, "function");
  const replies = Array.from(await context.generateReplies(payload(), 3), String);
  assert.deepEqual(replies, [
    "真正省下来的不是时间，是少走弯路的成本",
    "很多人怕被替代，其实先被替代的是低质量重复",
    "工具没变聪明，聪明的是会用工具的人"
  ]);
});

function recordingFetch(responseBody, contentType = "application/json") {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: { get: () => contentType },
      text: async () => typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)
    };
  };
  return { calls, fetchImpl };
}

test("anthropic provider posts to /v1/messages with x-api-key header and parses content[].text", async () => {
  const { calls, fetchImpl } = recordingFetch({
    content: [{
      type: "text",
      text: JSON.stringify([
        "项目不是讲故事，是把交付节奏跑出来",
        "市场只奖励能持续上线的团队，废话再多也没用",
        "比起愿景，先把这个月能跑通的环节稳住"
      ])
    }]
  });

  const context = loadBackground({
    settings: providerSettings("anthropic"),
    fetchImpl
  });

  const replies = await context.generateReplies(payload(), 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(calls[0].init.headers["x-api-key"], "sk-ant-test");
  assert.equal(calls[0].init.headers["anthropic-version"], "2023-06-01");
  assert.equal(replies.length, 3);
});

test("gemini provider posts to /models/{model}:generateContent with x-goog-api-key header", async () => {
  const { calls, fetchImpl } = recordingFetch({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify([
            "技术债不还，迟早还利息",
            "讨论永远比执行轻松，所以大多数人留在讨论里",
            "速度本身就是优势，慢就是另一种放弃"
          ])
        }]
      }
    }]
  });

  const context = loadBackground({
    settings: providerSettings("gemini"),
    fetchImpl
  });

  const replies = await context.generateReplies(payload(), 3);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
  );
  assert.equal(calls[0].init.headers["x-goog-api-key"], "AIzaSyTEST");
  assert.ok(!("Authorization" in calls[0].init.headers), "gemini 不应携带 Authorization");
  assert.equal(replies.length, 3);
});

test("newapi provider routes through OpenAI chat completions endpoint", async () => {
  const { calls, fetchImpl } = recordingFetch({
    choices: [{
      message: {
        content: JSON.stringify([
          "上线之前再多预判，都不如真实流量教做人",
          "团队的差距就在收到反馈到改完的那个小时里",
          "做不出复购的功能，不是产品问题，是没人愿意为它停下来"
        ])
      }
    }]
  });

  const context = loadBackground({
    settings: providerSettings("newapi"),
    fetchImpl
  });

  const replies = await context.generateReplies(payload(), 3);
  assert.equal(calls[0].url, "https://newapi.hitu.me/v1/chat/completions");
  assert.match(calls[0].init.headers.Authorization, /^Bearer sk-newapi$/);
  assert.equal(replies.length, 3);
});

test("legacy provider id 'chat' is migrated to 'openai_chat' at request time", async () => {
  const { calls, fetchImpl } = recordingFetch({
    choices: [{
      message: {
        content: JSON.stringify([
          "升级要悄悄的，用户感觉不到才算成功",
          "数据迁移最怕的是写了一半没人复核",
          "向后兼容写错一个字段，新老两版都会出事"
        ])
      }
    }]
  });

  // 老用户：顶层 provider="chat" + 顶层 apiKey/model/apiBase，没有 providerProfiles
  const context = loadBackground({
    settings: baseSettings({
      provider: "chat",
      apiKey: "sk-legacy",
      apiBase: "https://api.openai.com/v1",
      model: "gpt-4.1-mini"
    }),
    fetchImpl
  });

  const replies = await context.generateReplies(payload(), 3);
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.match(calls[0].init.headers.Authorization, /^Bearer sk-legacy$/);
  assert.equal(replies.length, 3);
});
