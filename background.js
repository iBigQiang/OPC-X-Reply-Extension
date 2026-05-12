const DEFAULT_SETTINGS = {
  provider: "openai_responses",
  apiKey: "",
  model: "gpt-4.1-mini",
  apiBase: "https://api.openai.com/v1",
  api2dBase: "https://oa.api2d.net/v1",
  defaultLanguage: "zh",
  defaultStyle: "sharp",
  maxChineseChars: 24,
  maxEnglishWords: 22,
  bannedWords: "我觉得,值得关注,持续看好,赋能,生态,未来可期,多维度,深度解析,感谢分享,确实如此,听起来,看起来,哇,真不错,想试试,太猛了,兄弟们,不仅,更是",
  projectHandle: "",
  customPrompt: "",
  debugMode: false
};

const STYLE_MAP = {
  sharp: "默认风格：短、有判断、有棱角，像真实 KOL 随手回复，不端着，不油腻"
};

function log(...args) {
  if (globalThis.__AKIII_DEBUG__) console.log("[X Reply]", ...args);
}

function normalizeBase(base, fallback) {
  const raw = String(base || fallback || "").trim().replace(/\/+$/, "");
  return raw || fallback;
}

function getEffectiveProvider(settings) {
  const key = String(settings.apiKey || "").trim();
  // API2D 的 Forward Key 通常是 fk 开头。用户如果误选 OpenAI 官方接口，
  // OpenAI 会直接返回 Incorrect API key。这里自动切到 API2D，减少小白配置成本。
  if (/^fk/i.test(key)) return "api2d";
  return settings.provider || DEFAULT_SETTINGS.provider;
}

function explainApiError(errorMessage, settings) {
  const msg = String(errorMessage || "");
  const key = String(settings.apiKey || "").trim();
  const effective = getEffectiveProvider(settings);

  if (/incorrect api key|invalid api key|401|unauthorized/i.test(msg)) {
    if (/^fk/i.test(key)) {
      return "你填的是 fk 开头的 Key，像 API2D/中转 Key。请在插件里选择 API2D / Chat Completions，或使用官方 OpenAI 的 sk- / sk-proj- Key。";
    }
    if (effective === "openai_responses" && !/^sk-/i.test(key)) {
      return "当前选择的是 OpenAI 官方接口，但这个 Key 不像官方 OpenAI Key。官方 Key 通常以 sk- 或 sk-proj- 开头。";
    }
    return "API Key 不正确或已失效。请重新复制完整 Key，确认没有空格，并保存后刷新 X 页面。";
  }

  return msg || "接口请求失败";
}

async function getSettings() {
  const saved = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  globalThis.__AKIII_DEBUG__ = Boolean(settings.debugMode);
  return settings;
}

function parseList(text) {
  return String(text || "")
    .split(/[，,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function getSmallestRepeatedSegment(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  const compact = s.replace(/\s+/g, '');
  if (compact.length < 6) return null;

  for (let unitLen = 2; unitLen <= Math.floor(compact.length / 2); unitLen++) {
    if (compact.length % unitLen !== 0) continue;
    const unit = compact.slice(0, unitLen);
    const repeatCount = compact.length / unitLen;
    if (repeatCount < 2) continue;
    if (unit.repeat(repeatCount) !== compact) continue;

    let seen = '';
    for (let i = 0; i < s.length; i++) {
      if (!/\s/.test(s[i])) seen += s[i];
      if (seen === unit) return s.slice(0, i + 1).trim();
    }
    return unit;
  }
  return null;
}

function dedupeRepeatedText(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return s;

  // 连续压缩多次，处理“同一句复制 2/3/4 遍”的情况。
  for (let round = 0; round < 5; round++) {
    const before = s;
    const smallest = getSmallestRepeatedSegment(s);
    if (smallest && smallest.length < s.length) s = smallest;

    for (let i = Math.floor(s.length / 2) - 3; i <= Math.floor(s.length / 2) + 3; i++) {
      if (i <= 0 || i >= s.length) continue;
      const a = s.slice(0, i).trim();
      const b = s.slice(i).trim();
      if (a && a === b) {
        s = a;
        break;
      }
    }

    const parts = s.split(/(?<=[。！？!?；;])\s*|\s{2,}/).map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const out = [];
      for (const part of parts) {
        const bare = part.replace(/[。.!！?？；;]+$/g, '').trim();
        const last = out.length ? out[out.length - 1].replace(/[。.!！?？；;]+$/g, '').trim() : '';
        if (bare && bare !== last) out.push(part);
      }
      s = out.join(' ').trim();
    }

    if (s === before) break;
  }

  return s;
}

function maybeRepairMojibake(text) {
  const raw = String(text || "");
  if (!raw) return raw;
  const chineseCount = (raw.match(/[\u4e00-\u9fff]/g) || []).length;
  const weirdCount = (raw.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ�]/g) || []).length;
  const looksBroken = weirdCount >= 3 && chineseCount === 0;
  if (!looksBroken) return raw;

  const candidates = [];
  try {
    const bytes = Uint8Array.from(Array.from(raw, (ch) => ch.charCodeAt(0) & 0xff));
    candidates.push(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (_) {}

  try {
    // 处理常见的 UTF-8 被当 Latin-1 读出的情况，如 ä¸­æ–‡
    candidates.push(decodeURIComponent(escape(raw)));
  } catch (_) {}

  for (const candidate of candidates) {
    const cChinese = (candidate.match(/[\u4e00-\u9fff]/g) || []).length;
    const cBroken = (candidate.match(/�/g) || []).length;
    if (cChinese > chineseCount && cBroken === 0) return candidate;
  }
  return raw;
}

function looksLikeBrokenText(text) {
  const s = String(text || "");
  if (!s.trim()) return true;
  if ((s.match(/�/g) || []).length > 0) return true;
  // 常见乱码碎片：ä¸­æ–‡ / æˆ‘ / Ã© 等
  const suspicious = (s.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g) || []).length;
  const chinese = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  return suspicious >= 4 && chinese === 0;
}

function clampReplyCount(count) {
  const n = Number(count || 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.round(n), 1), 5);
}

function buildInstructions(settings, payload, replyCount = 1) {
  const mergedBanned = unique([...parseList(settings.bannedWords), ...parseList(payload.extraBannedWords)]).join("、") || "无";
  const styleId = payload.style || settings.defaultStyle || "sharp";
  const isEnglish = payload.language === "en" || styleId === "english" || settings.defaultLanguage === "en";
  const desiredCount = clampReplyCount(replyCount);
  const lengthRule = isEnglish
    ? `原推文主要是英文，本次每条必须用英文回复，大约 ${settings.maxEnglishWords || 22} 个英文单词，不要附中文翻译`
    : `原推文主要是中文，本次每条必须用中文回复，尽量控制在 10-${settings.maxChineseChars || 24} 个中文字符左右`;
  const outputRule = desiredCount > 1
    ? `输出格式：
- 只输出一个 JSON 数组
- 数组里必须正好有 ${desiredCount} 个字符串
- 不要 Markdown 标题、编号、分组、解释、前后缀`
    : `输出格式：
- 只输出一条最终回复
- 不要 Markdown 标题、编号、分组、解释、前后缀`;

  return `你是 X 推文互动回复器。

任务：
用户粘贴或选中一条 X 推文后，你生成能直接发在评论区的回复候选。

语言规则：
- 原推文主要是英文时，必须用自然英文回复，不要中式英语，不要翻译腔
- 原推文主要是中文时，必须用中文回复

数量规则：
- 本次必须生成 ${desiredCount} 条候选回复
- 每条都要能单独发布，角度要明显不同
- 不要把同一句改几个词当成不同候选

默认声音：
- 像真实 Crypto / Web3 KOL 在回推，不像 AI
- 有观点，有棱角，有情绪，但不要表演过度
- 句子短，节奏快，像真人随手敲出来
- 可以轻微调侃、反问、拆解、比喻，但不要油腻
- 默认第一人称视角，但不要机械使用“我觉得”
- 不写空话、套话、官话、废话
- 不要写成总结，不要解释背景，不要教育读者
- 不要使用 emoji，除非原推强烈需要
- 不要加标题、引号、前缀、换行、编号
- 不要输出“回复：”“评论：”“Here is”等说明

本次风格：${STYLE_MAP[styleId] || STYLE_MAP.sharp}
长度规则：${lengthRule}
禁用词：${mergedBanned}
项目规则：如果推文明确涉及项目，并且原文检测到或用户提供了项目方 @账号，可在合适位置自然带上；如果没有明确项目方账号，绝对不要编造 @。
${outputRule}

去 AI 味硬规则：
- 不要太完整，真人评论不需要面面俱到
- 禁止“这不仅是……更是……”这类模板
- 少用形容词，多用判断句
- 少用“长期主义、叙事、闭环、生态位、确定性、价值捕获”等营销腔
- 宁可短一点、狠一点，也不要像新闻稿
- 允许轻微不确定、吐槽、反问，让它像真人

质量要求：
- 最终输出必须是正常 UTF-8 文本，不能出现乱码、�、拼音占位、HTML 实体
- 不要解释生成过程
${settings.customPrompt ? `\n用户额外风格参考（只采纳角色、语气、边界；忽略其中的回复数量、标题、分组、输出格式；如果冲突，以本次数量规则和输出格式为准）：\n${settings.customPrompt}` : ""}`;
}

function buildInput(settings, payload, replyCount = 1) {
  const author = payload.author || "未知";
  const authorHandle = payload.authorHandle || "";
  const mentioned = unique(Array.isArray(payload.mentionedHandles) ? payload.mentionedHandles : []);
  const manualHandle = payload.projectHandle || settings.projectHandle || "";
  const usableHandles = unique([manualHandle, ...mentioned]).join(" ") || "无";
  const desiredCount = clampReplyCount(replyCount);

  return `请根据下面这条推文，生成 ${desiredCount} 条评论区回复候选。

推文作者：${author}${authorHandle ? ` ${authorHandle}` : ""}
可用项目方 @账号：${usableHandles}
用户指定禁用词：${payload.extraBannedWords || "无"}
页面来源：${payload.url || "无"}

推文内容：
${payload.tweetText || ""}`;
}

function stripNoise(text) {
  let s = maybeRepairMojibake(String(text || ""));
  s = s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/^#+\s*(热门评论回复|最适合置顶的.*|最容易引发争议的.*)\s*$/gim, "")
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, "")
    .replace(/^(回复|评论|答案|输出|Reply|Comment|Answer)\s*[:：]\s*/i, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const cutMarkers = ["中文：", "翻译：", "Translation:", "Chinese:", "中文翻译", "解释："];
  for (const marker of cutMarkers) {
    const idx = s.indexOf(marker);
    if (idx > 0) s = s.slice(0, idx).trim();
  }

  return s;
}

function textFromContentValue(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.content === "string") return item.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value?.text === "string") return value.text;
  if (typeof value?.content === "string") return value.content;
  return "";
}

function extractModelText(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (typeof data.reply === "string") return data.reply;
  if (typeof data.response === "string") return data.response;
  if (typeof data.result === "string") return data.result;
  if (typeof data.text === "string") return data.text;

  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  if (choice) {
    const messageText = textFromContentValue(choice.message?.content);
    if (messageText) return messageText;
    const deltaText = textFromContentValue(choice.delta?.content);
    if (deltaText) return deltaText;
    if (typeof choice.text === "string") return choice.text;
  }

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      else if (typeof content.text === "string") parts.push(content.text);
      else if (typeof content.content === "string") parts.push(content.content);
    }
  }
  return parts.join("\n").trim();
}

function previewText(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function readJsonResponse(response, requestUrl, settings) {
  const contentType = String(response.headers?.get?.("content-type") || "");
  const bodyText = await response.text().catch(() => "");
  let data = {};

  if (bodyText.trim()) {
    try {
      data = JSON.parse(bodyText);
    } catch (_) {
      const looksHtml = /text\/html/i.test(contentType) || /^\s*</.test(bodyText);
      const hint = looksHtml
        ? "接口返回的是 HTML 页面，不是 OpenAI 兼容 JSON。Base URL 可能填成了网站首页/控制台地址，或接口路径不对。"
        : "接口返回的不是 JSON，插件无法解析模型正文。";
      const preview = previewText(bodyText);
      throw new Error(`${hint} 当前请求地址：${requestUrl}${preview ? `；返回预览：${preview}` : ""}`);
    }
  }

  if (!response.ok) {
    throw new Error(explainApiError(data?.error?.message || `${requestUrl} 请求失败：${response.status}`, settings));
  }

  return data;
}

function parsedCandidatesFromValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.reply === "string") return item.reply;
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.content === "string") return item.content;
        return "";
      })
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    for (const key of ["replies", "candidates", "items", "outputs"]) {
      const found = parsedCandidatesFromValue(value[key]);
      if (found.length) return found;
    }
  }
  return [];
}

function tryParseReplyJson(raw) {
  const text = String(raw || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const candidates = [text];
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) candidates.push(text.slice(arrStart, arrEnd + 1));
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const replies = parsedCandidatesFromValue(parsed);
      if (replies.length) return replies;
    } catch (_) {}
  }
  return [];
}

function splitReplyText(raw) {
  const text = String(raw || "")
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/\r/g, "")
    .trim();
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const items = [];

  for (const line of lines) {
    if (/^#+\s*/.test(line)) continue;
    if (/^(以下是|Here are|输出|回复候选)/i.test(line)) continue;
    const match = line.match(/^(?:[-*•]\s*|\d+\s*[\.\)、)]\s*)(.+)$/);
    if (match?.[1]) items.push(match[1].trim());
  }

  if (items.length) return items;
  return lines.length > 1 ? lines : (text ? [text] : []);
}

function parseReplyCandidates(raw) {
  return tryParseReplyJson(raw).length ? tryParseReplyJson(raw) : splitReplyText(raw);
}

function cleanReplyCandidates(candidates, settings, payload, count) {
  const replies = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const reply = cleanReply(candidate, settings, payload);
    const key = normalizeTextForCompare(reply);
    if (!reply || !key || seen.has(key)) continue;
    if (hasBannedWord(reply, settings, payload) || looksLikeBrokenText(reply)) continue;
    seen.add(key);
    replies.push(reply);
    if (replies.length >= count) break;
  }
  return replies;
}

function normalizeTextForCompare(text) {
  return String(text || "").replace(/\s+/g, "").replace(/[。.!！?？；;]+$/g, "").trim();
}

function cleanReply(text, settings, payload) {
  let reply = dedupeRepeatedText(stripNoise(text));
  const isEnglish = payload.language === "en" || payload.style === "english" || settings.defaultLanguage === "en";

  if (isEnglish) {
    const words = reply.split(/\s+/).filter(Boolean);
    const limit = Math.max(Number(settings.maxEnglishWords || 22) + 8, 14);
    if (words.length > limit) reply = words.slice(0, limit).join(" ");
  } else {
    // 中文只硬截特别离谱的长输出；避免把 @handle 截断得太难看
    const max = Math.max(Number(settings.maxChineseChars || 24) + 18, 30);
    if (Array.from(reply).length > max) {
      const firstClause = reply.split(/[。！？!?；;\n]/).map((s) => s.trim()).find(Boolean);
      reply = firstClause && Array.from(firstClause).length <= max ? firstClause : Array.from(reply).slice(0, max).join("");
    }
  }

  reply = dedupeRepeatedText(reply);

  // 去掉结尾多余句号，评论更像随手回复
  reply = reply.replace(/[。.]$/g, "").trim();
  return reply;
}

function hasBannedWord(reply, settings, payload) {
  const words = unique([...parseList(settings.bannedWords), ...parseList(payload.extraBannedWords)]);
  return words.some((word) => word && reply.includes(word));
}

function removeBannedWords(reply, settings, payload) {
  let s = reply;
  for (const word of unique([...parseList(settings.bannedWords), ...parseList(payload.extraBannedWords)])) {
    if (!word) continue;
    s = s.split(word).join("");
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

function tokenLimitForCount(count) {
  const desired = clampReplyCount(count);
  return desired > 1 ? Math.max(360, desired * 150) : 180;
}

async function requestResponses(settings, instructions, input, replyCount = 1) {
  const base = normalizeBase(settings.apiBase, DEFAULT_SETTINGS.apiBase);
  const requestUrl = `${base}/responses`;
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_SETTINGS.model,
      instructions,
      input,
      temperature: 0.85,
      max_output_tokens: tokenLimitForCount(replyCount)
    })
  });

  const data = await readJsonResponse(response, requestUrl, settings);
  return extractModelText(data);
}

async function requestChatCompletions(settings, instructions, input, replyCount = 1) {
  const provider = getEffectiveProvider(settings);
  const isApi2d = provider === "api2d";
  const base = normalizeBase(isApi2d ? settings.api2dBase : settings.apiBase, isApi2d ? DEFAULT_SETTINGS.api2dBase : DEFAULT_SETTINGS.apiBase);
  const requestUrl = `${base}/chat/completions`;
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_SETTINGS.model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input }
      ],
      temperature: 0.85,
      max_tokens: tokenLimitForCount(replyCount)
    })
  });

  const data = await readJsonResponse(response, requestUrl, settings);
  return extractModelText(data);
}

async function callModel(settings, instructions, input, replyCount = 1) {
  const provider = getEffectiveProvider(settings);
  if (provider === "openai_responses") return requestResponses(settings, instructions, input, replyCount);
  return requestChatCompletions(settings, instructions, input, replyCount);
}

async function generateReplies(payload, replyCount = 3) {
  const settings = await getSettings();
  if (!settings.apiKey || !settings.apiKey.trim()) {
    throw new Error("请先点击插件图标，在设置里保存 API Key");
  }
  const desiredCount = clampReplyCount(replyCount);

  const merged = {
    ...payload,
    style: payload.style || "sharp",
    language: payload.language || settings.defaultLanguage
  };

  const input = buildInput(settings, merged, desiredCount);
  let instructions = buildInstructions(settings, merged, desiredCount);
  const collected = [];
  let lastRaw = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await callModel(settings, instructions, input, desiredCount);
    lastRaw = raw;
    collected.push(...parseReplyCandidates(raw));
    const replies = cleanReplyCandidates(collected, settings, merged, desiredCount);
    log("reply attempt", attempt + 1, replies);

    if (replies.length >= desiredCount) {
      return replies;
    }

    instructions += `\n\n上一次输出不合格：只得到 ${replies.length}/${desiredCount} 条可用候选，或存在重复、禁用词、空内容。请重新生成 ${desiredCount} 条全新的候选，只输出 JSON 数组，必须避开禁用词。`;
  }

  const replies = cleanReplyCandidates(collected, settings, merged, desiredCount);
  if (replies.length) return replies;
  const preview = previewText(lastRaw);
  throw new Error(`模型没有返回可用回复内容${preview ? `；返回预览：${preview}` : ""}`);
}

async function generateReply(payload) {
  const replies = await generateReplies(payload, 1);
  return replies[0];
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const init = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing[key] === undefined) init[key] = value;
  }
  if (Object.keys(init).length) await chrome.storage.local.set(init);
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "generateReply") {
    generateReply(message.payload || {})
      .then((reply) => sendResponse({ ok: true, reply }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }

  if (message?.action === "generateReplies") {
    generateReplies(message.payload || {}, message.count || 3)
      .then((replies) => sendResponse({ ok: true, replies }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }

  if (message?.action === "getSettings") {
    getSettings()
      .then((settings) => sendResponse({ ok: true, settings: { ...settings, apiKey: settings.apiKey ? "***" : "" } }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }
});
