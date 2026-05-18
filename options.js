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
  openai_chat:      "填到 /v1 这一级，例如 https://api.openai.com/v1。",
  openai_responses: "填到 /v1 这一级，例如 https://api.openai.com/v1。",
  gemini:           "填到 /v1beta 这一级，例如 https://generativelanguage.googleapis.com/v1beta；扩展会自动拼上 /models/{model}:generateContent。",
  anthropic:        "填到域名根，例如 https://api.anthropic.com 或 https://api.deepseek.com/anthropic；扩展会自动拼上 /v1/messages。",
  newapi:           "填你部署的 New API 实例地址到 /v1 这一级，例如 https://newapi.hitu.me/v1。",
  sub2api:          "填你部署的 Sub2API 实例地址到 /v1 这一级，例如 https://demo.sub2api.org/v1。",
  api2d:            "API2D 官方地址：https://oa.api2d.net/v1。",
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

// 8 个 provider 走的真实 endpoint —— 与 background.js 的 buildRequestUrl 一一对应。
// 修改时务必同时改 background.js，否则预览跟实际请求会对不上。
function buildEndpointPreview(provider, base, model, customProtocol) {
  const trimmed = String(base || "").trim().replace(/\/+$/, "");
  const modelLabel = String(model || "").trim() || "{model}";

  switch (provider) {
    case "openai_chat":
    case "newapi":
    case "sub2api":
    case "api2d":
      return `${trimmed}/chat/completions`;
    case "openai_responses":
      return `${trimmed}/responses`;
    case "gemini":
      return `${trimmed}/models/${modelLabel}:generateContent`;
    case "anthropic":
      return `${trimmed}/v1/messages`;
    case "custom":
      return trimmed || "（自定义：请填写完整 endpoint URL）";
    default:
      return `${trimmed}/chat/completions`;
  }
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

load();
