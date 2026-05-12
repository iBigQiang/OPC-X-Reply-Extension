const DEFAULT_SETTINGS = {
  provider: "openai_responses",
  apiKey: "",
  model: "gpt-4.1-mini",
  apiBase: "https://api.openai.com/v1",
  api2dBase: "https://oa.api2d.net/v1",
  defaultLanguage: "zh",
  maxChineseChars: 24,
  maxEnglishWords: 22,
  bannedWords: "我觉得,值得关注,持续看好,赋能,生态,未来可期,多维度,深度解析,感谢分享,确实如此,听起来,看起来,哇,真不错,想试试,太猛了,兄弟们,不仅,更是",
  projectHandle: "",
  customPrompt: "",
  debugMode: false
};

const $ = (id) => document.getElementById(id);
const FIELDS = Object.keys(DEFAULT_SETTINGS);

function setStatus(text, ok = true) {
  const el = $("status");
  el.textContent = text;
  el.style.color = ok ? "#008a5c" : "#f4212e";
  setTimeout(() => {
    if (el.textContent === text) el.textContent = "";
  }, 2600);
}

async function load() {
  const data = await chrome.storage.local.get(FIELDS);
  const settings = { ...DEFAULT_SETTINGS, ...data };
  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = Boolean(settings[key]);
    else el.value = settings[key] ?? "";
  }
}

function readForm() {
  const settings = {};
  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;
    if (el.type === "checkbox") settings[key] = Boolean(el.checked);
    else if (key === "maxChineseChars" || key === "maxEnglishWords") settings[key] = Number(el.value || DEFAULT_SETTINGS[key]);
    else settings[key] = el.value.trim();
  }
  settings.defaultStyle = "sharp";
  return settings;
}

function normalizeProviderByKey(settings) {
  const key = String(settings.apiKey || "").trim();
  if (/^fk/i.test(key) && settings.provider !== "api2d") {
    settings.provider = "api2d";
    const providerEl = $("provider");
    if (providerEl) providerEl.value = "api2d";
    return "检测到 fk 开头 Key，已自动切换为 API2D";
  }
  return "已保存";
}

async function save() {
  const settings = readForm();
  const saveMessage = normalizeProviderByKey(settings);
  if (!settings.apiKey.trim()) {
    setStatus("请先填写 API Key", false);
    return;
  }
  if (settings.provider === "openai_responses" && !settings.apiBase.trim()) {
    setStatus("请填写 OpenAI Base URL", false);
    return;
  }
  if (settings.provider === "api2d" && !settings.api2dBase.trim()) {
    setStatus("请填写 API2D Base URL", false);
    return;
  }
  await chrome.storage.local.set(settings);
  setStatus(saveMessage);
}

async function reset() {
  const current = readForm();
  await chrome.storage.local.set({ ...DEFAULT_SETTINGS, apiKey: current.apiKey });
  await load();
  setStatus("已恢复默认，API Key 已保留");
}

$("save").addEventListener("click", save);
$("reset").addEventListener("click", reset);
load();
