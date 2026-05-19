const PROVIDER_IDS = [
  "openai_chat",
  "openai_responses",
  "gemini",
  "anthropic",
  "newapi",
  "sub2api",
  "api2d",
  "custom"
];

const PROVIDER_DEFAULTS = {
  openai_chat:      { apiKey: "", model: "gpt-4.1-mini",       apiBase: "https://api.openai.com/v1" },
  openai_responses: { apiKey: "", model: "gpt-4.1-mini",       apiBase: "https://api.openai.com/v1" },
  gemini:           { apiKey: "", model: "gemini-2.0-flash",   apiBase: "https://generativelanguage.googleapis.com/v1beta" },
  anthropic:        { apiKey: "", model: "claude-sonnet-4-5",  apiBase: "https://api.anthropic.com" },
  newapi:           { apiKey: "", model: "gpt-4.1-mini",       apiBase: "" },
  sub2api:          { apiKey: "", model: "gpt-4.1-mini",       apiBase: "" },
  api2d:            { apiKey: "", model: "gpt-4o-mini",        apiBase: "https://oa.api2d.net/v1" },
  custom:           { apiKey: "", model: "", apiBase: "", customProtocol: "openai_chat" }
};

const PROVIDER_BASE_HINTS = {
  openai_chat:      "可填根域名或带 /v1，例如 https://api.openai.com 或 https://api.openai.com/v1，扩展会自动补 /chat/completions。末尾加 # 强制按完整 URL 处理。",
  openai_responses: "可填根域名或带 /v1，例如 https://api.openai.com，扩展会自动补 /responses。末尾加 # 强制按完整 URL 处理。",
  gemini:           "可填根域名或带 /v1beta，例如 https://generativelanguage.googleapis.com，扩展会自动补 /v1beta/models/{model}:generateContent。末尾加 # 强制按完整 URL 处理。",
  anthropic:        "可填根域名或带 /v1，例如 https://api.anthropic.com 或 https://api.deepseek.com/anthropic，扩展会自动补 /v1/messages。末尾加 # 强制按完整 URL 处理。",
  newapi:           "可填根域名或带 /v1，例如 https://newapi.hitu.me，扩展会自动补 /v1/chat/completions。",
  sub2api:          "可填根域名或带 /v1，例如 https://demo.sub2api.org，扩展会自动补 /v1/chat/completions。",
  api2d:            "可填 https://oa.api2d.net 或 https://oa.api2d.net/v1，扩展会自动补 /v1/chat/completions。",
  custom:           "自定义渠道下，请直接填写完整 endpoint URL（含路径），例如 https://api.example.com/v1/chat/completions。"
};

const DEFAULT_SETTINGS = {
  provider: "openai_responses",
  apiKey: "",
  model: "gpt-4.1-mini",
  apiBase: "https://api.openai.com/v1",
  api2dBase: "https://oa.api2d.net/v1",
  providerProfiles: emptyProviderProfiles(),
  defaultLanguage: "zh",
  maxChineseChars: 24,
  maxEnglishWords: 22,
  bannedWords: "我觉得,值得关注,持续看好,赋能,生态,未来可期,多维度,深度解析,感谢分享,确实如此,听起来,看起来,哇,真不错,想试试,太猛了,兄弟们,不仅,更是",
  projectHandle: "",
  customPrompt: "",
  debugMode: false
};

function emptyProviderProfiles() {
  const out = {};
  for (const id of PROVIDER_IDS) out[id] = { ...PROVIDER_DEFAULTS[id] };
  return out;
}

// 8 个 provider 走的真实 endpoint —— 与 background.js 的 buildFinalEndpoint 一一对应。
// v2.1.3 起支持自动补全：用户填根域名 / /v1 / /v1/ / 完整 endpoint / 末尾 # 透传 都能正确归一化。
// 修改时务必同时改 background.js，否则预览跟实际请求会对不上。
// 改这里前先看 docs/开发及迭代方案调研报告/2026-05-19-v2.1.3-Base-URL-自动补全归一化.md
function buildEndpointPreview(provider, base, model, customProtocol) {
  // custom 渠道完全透传：用户必须自己填完整 endpoint URL
  if (provider === "custom") {
    const trimmed = String(base || "").trim().replace(/\/+$/, "");
    return trimmed || "（自定义：请填写完整 endpoint URL）";
  }

  // 每个 provider 的 endpoint 拆为 versionSeg + endpointTail
  const PATH_SPEC = {
    openai_chat:      { versionSeg: "/v1",     endpointTail: "/chat/completions" },
    openai_responses: { versionSeg: "/v1",     endpointTail: "/responses" },
    newapi:           { versionSeg: "/v1",     endpointTail: "/chat/completions" },
    sub2api:          { versionSeg: "/v1",     endpointTail: "/chat/completions" },
    api2d:            { versionSeg: "/v1",     endpointTail: "/chat/completions" },
    anthropic:        { versionSeg: "/v1",     endpointTail: "/messages" },
    gemini:           { versionSeg: "/v1beta", endpointTail: "/models/{model}:generateContent" }
  };

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const raw = String(base || "").trim();
  if (!raw) return "—";

  // 1. # 终止符（Cherry Studio 风格）：用户显式声明完整 URL，仅去掉末尾 # 和 /
  if (raw.endsWith("#")) {
    return raw.slice(0, -1).replace(/\/+$/, "") || "—";
  }

  // 2. 去掉末尾 0+ 个 /
  const trimmed = raw.replace(/\/+$/, "");

  // 3. 未知 provider 兜底为 openai_chat 风格
  const spec = PATH_SPEC[provider] || PATH_SPEC.openai_chat;

  // 4. 用户已填完整 endpoint：识别并透传
  if (provider === "gemini") {
    if (/\/models\/[^/]+:generateContent$/i.test(trimmed)) return trimmed;
  } else {
    const fullSuffix = (spec.versionSeg + spec.endpointTail).toLowerCase();
    if (trimmed.toLowerCase().endsWith(fullSuffix)) return trimmed;
  }

  // 5. 用户已以 versionSeg 结尾：直接拼 endpointTail
  // 精确末尾匹配：/v1$ 不会误判 /v1beta
  const versionEndRe = new RegExp(escapeRe(spec.versionSeg) + "$", "i");
  const baseWithVersion = versionEndRe.test(trimmed)
    ? trimmed
    : trimmed + spec.versionSeg;

  // 6. 拼 endpointTail（gemini 替换 {model} 占位）
  let tail = spec.endpointTail;
  if (provider === "gemini") {
    const modelLabel = String(model || "").trim() || "{model}";
    tail = tail.replace("{model}", modelLabel);
  }
  return baseWithVersion + tail;
}

if (typeof globalThis !== "undefined") {
  globalThis.buildEndpointPreview = buildEndpointPreview;
}

const $ = (id) => document.getElementById(id);

const TOP_LEVEL_FIELDS = [
  "provider",
  "apiKey",
  "model",
  "apiBase",
  "api2dBase",
  "providerProfiles",
  "defaultLanguage",
  "maxChineseChars",
  "maxEnglishWords",
  "bannedWords",
  "projectHandle",
  "customPrompt",
  "debugMode"
];

let currentProvider = "openai_responses";
let providerProfiles = emptyProviderProfiles();

function setStatus(text, ok = true) {
  const el = $("status");
  el.textContent = text;
  el.style.color = ok ? "#7cffde" : "#ff7da6";
  setTimeout(() => {
    if (el.textContent === text) el.textContent = "";
  }, 2600);
}

function normalizeProfile(profile, defaults) {
  return {
    apiKey: profile?.apiKey ?? defaults.apiKey ?? "",
    model: profile?.model ?? defaults.model ?? "",
    apiBase: profile?.apiBase ?? defaults.apiBase ?? "",
    customProtocol: profile?.customProtocol ?? defaults.customProtocol ?? "openai_chat"
  };
}

function migrateProvider(raw) {
  if (raw === "chat") return "openai_chat";
  return PROVIDER_IDS.includes(raw) ? raw : "openai_responses";
}

async function load() {
  const data = await chrome.storage.local.get(TOP_LEVEL_FIELDS);
  const merged = { ...DEFAULT_SETTINGS, ...data };

  currentProvider = migrateProvider(merged.provider);

  const incoming = { ...emptyProviderProfiles(), ...(merged.providerProfiles || {}) };
  for (const id of PROVIDER_IDS) {
    incoming[id] = normalizeProfile(incoming[id], PROVIDER_DEFAULTS[id]);
  }

  // 老版本顶层字段优先回填到当前 provider 的 profile —— 避免升级后用户重新配置
  const activeProfile = incoming[currentProvider];
  if (merged.apiKey && !activeProfile.apiKey) activeProfile.apiKey = merged.apiKey;
  if (merged.model && activeProfile.model === PROVIDER_DEFAULTS[currentProvider].model) activeProfile.model = merged.model;
  if (merged.apiBase && activeProfile.apiBase === PROVIDER_DEFAULTS[currentProvider].apiBase) activeProfile.apiBase = merged.apiBase;
  if (merged.api2dBase && !incoming.api2d.apiBase) incoming.api2d.apiBase = merged.api2dBase;

  providerProfiles = incoming;

  $("provider").value = currentProvider;
  $("defaultLanguage").value = merged.defaultLanguage || "zh";
  $("maxChineseChars").value = merged.maxChineseChars ?? DEFAULT_SETTINGS.maxChineseChars;
  $("maxEnglishWords").value = merged.maxEnglishWords ?? DEFAULT_SETTINGS.maxEnglishWords;
  $("bannedWords").value = merged.bannedWords ?? "";
  $("projectHandle").value = merged.projectHandle ?? "";
  $("customPrompt").value = merged.customPrompt ?? "";
  $("debugMode").checked = Boolean(merged.debugMode);

  fillProviderFields(currentProvider);
}

function fillProviderFields(provider) {
  const profile = providerProfiles[provider] || PROVIDER_DEFAULTS[provider];
  $("apiKey").value = profile.apiKey || "";
  $("model").value = profile.model || "";
  $("apiBase").value = profile.apiBase || "";
  $("customProtocol").value = profile.customProtocol || "openai_chat";
  $("customProtocolRow").style.display = provider === "custom" ? "" : "none";
  $("apiBaseHint").textContent = PROVIDER_BASE_HINTS[provider] || "";
  updatePreview();
}

function snapshotProfileFromForm(provider) {
  const profile = {
    apiKey: $("apiKey").value.trim(),
    model: $("model").value.trim(),
    apiBase: $("apiBase").value.trim()
  };
  if (provider === "custom") profile.customProtocol = $("customProtocol").value || "openai_chat";
  return profile;
}

function updatePreview() {
  const provider = $("provider").value;
  const base = $("apiBase").value;
  const model = $("model").value;
  const customProtocol = $("customProtocol").value;
  const url = buildEndpointPreview(provider, base, model, customProtocol);
  $("apiBasePreview").textContent = `完整 API_Base_URL 预览：${url || "—"}`;
}

function onProviderChange() {
  // 把当前表单内容写回旧 provider 的 profile（用户来回切换时不会丢）
  providerProfiles[currentProvider] = {
    ...providerProfiles[currentProvider],
    ...snapshotProfileFromForm(currentProvider)
  };
  currentProvider = $("provider").value;
  fillProviderFields(currentProvider);
}

function readForm() {
  // 把当前表单覆盖回 providerProfiles[currentProvider]，再回写顶层兼容字段
  providerProfiles[currentProvider] = {
    ...providerProfiles[currentProvider],
    ...snapshotProfileFromForm(currentProvider)
  };

  // fk 开头 Key 自动切 API2D：把 Key 和 base 转移到 api2d profile，并切换激活 provider
  const apiKey = providerProfiles[currentProvider].apiKey;
  let saveMessage = "已保存";
  if (/^fk/i.test(apiKey) && currentProvider !== "api2d") {
    providerProfiles.api2d = {
      ...providerProfiles.api2d,
      apiKey,
      model: providerProfiles[currentProvider].model || providerProfiles.api2d.model,
      apiBase: providerProfiles.api2d.apiBase || PROVIDER_DEFAULTS.api2d.apiBase
    };
    currentProvider = "api2d";
    $("provider").value = "api2d";
    fillProviderFields("api2d");
    saveMessage = "检测到 fk 开头 Key，已自动切换为 API2D";
  }

  const active = providerProfiles[currentProvider];

  return {
    settings: {
      provider: currentProvider,
      apiKey: active.apiKey,
      model: active.model,
      apiBase: active.apiBase,
      api2dBase: providerProfiles.api2d.apiBase || DEFAULT_SETTINGS.api2dBase,
      providerProfiles,
      defaultLanguage: $("defaultLanguage").value || "zh",
      defaultStyle: "sharp",
      maxChineseChars: Number($("maxChineseChars").value || DEFAULT_SETTINGS.maxChineseChars),
      maxEnglishWords: Number($("maxEnglishWords").value || DEFAULT_SETTINGS.maxEnglishWords),
      bannedWords: $("bannedWords").value.trim(),
      projectHandle: $("projectHandle").value.trim(),
      customPrompt: $("customPrompt").value.trim(),
      debugMode: Boolean($("debugMode").checked)
    },
    saveMessage
  };
}

async function save() {
  const { settings, saveMessage } = readForm();

  if (!settings.apiKey.trim()) {
    setStatus("请先填写 API Key", false);
    return;
  }
  if (settings.provider === "custom" && !settings.apiBase.trim()) {
    setStatus("自定义渠道必须填写完整 endpoint URL", false);
    return;
  }
  if (settings.provider !== "custom" && !settings.apiBase.trim()) {
    setStatus(`${$("provider").options[$("provider").selectedIndex].text} 渠道需要 Base URL`, false);
    return;
  }

  await chrome.storage.local.set(settings);
  setStatus(saveMessage);
  updatePreview();
}

async function reset() {
  const currentApiKey = $("apiKey").value;
  const fresh = {
    ...DEFAULT_SETTINGS,
    providerProfiles: emptyProviderProfiles()
  };
  // 保留当前 provider 的 Key
  fresh.providerProfiles[currentProvider] = {
    ...fresh.providerProfiles[currentProvider],
    apiKey: currentApiKey
  };
  fresh.apiKey = currentApiKey;
  await chrome.storage.local.set(fresh);
  await load();
  setStatus("已恢复默认，API Key 已保留");
}

$("save").addEventListener("click", save);
$("reset").addEventListener("click", reset);
$("provider").addEventListener("change", onProviderChange);
$("apiBase").addEventListener("input", updatePreview);
$("model").addEventListener("input", updatePreview);
$("customProtocol").addEventListener("change", updatePreview);

$("apiKeyToggle").addEventListener("click", () => {
  const input = $("apiKey");
  const toggle = $("apiKeyToggle");
  const willShow = input.type === "password";
  input.type = willShow ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(willShow));
  toggle.setAttribute("aria-label", willShow ? "隐藏 API Key" : "显示 API Key");
});

load();
