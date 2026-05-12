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
