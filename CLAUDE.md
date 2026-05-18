# CLAUDE.md — X 推文互动回复器（项目专属规则）

> 本文件给 Claude 看，不是给最终用户看。最终用户视角的说明在 `README.md`。
> 本文件不重复 `~/.claude/CLAUDE.md` 全局规则，只写本项目特有的约束、避坑、命令。

## 一句话

X 推文互动回复器是一个 Chrome MV3 扩展，注入 `x.com` / `twitter.com`，在时间线和回复弹窗里挂出按钮，一次调用 LLM 生成 **3 条可编辑的回复候选**，用户挑一条手动复制或填入 X，**不自动发送**。

## 核心架构（原生 JS，无打包，无 npm 依赖）

- `manifest.json` — MV3：`background.service_worker` + `content_scripts(x.com, twitter.com, document_idle)` + `options_page`（无 `default_popup`）
- `background.js` — Service Worker：取设置 → 选 provider → 拼 prompt → 调 LLM → 清洗 → 返回数组；监听 `chrome.runtime.onMessage` 的 `generateReply` / `generateReplies` / `getSettings`
- `content.js` — 注入 X DOM：MutationObserver + scroll 触发扫描 → 给 article 和 toolbar 注入按钮 → 抓推文文本 → 调 background → 渲染右下角草稿窗 → 把选中的候选填入 X 编辑器
- `content.css` — 注入按钮、Toast、草稿窗的玻璃拟态样式
- `options.html` / `options.js` — 独立设置页，没有 popup，点击插件图标也走 `chrome.runtime.openOptionsPage()`
- `tests/*.test.mjs` — Node 原生 test runner，纯静态/纯 vm，不需要 Chromium

**消息链：**

```
content.js (用户点 AI回/AI填入)
  └─ chrome.runtime.sendMessage({action:"generateReplies", payload, count:3})
        ↓
background.js
  ├─ generateReplies → callModel → requestResponses 或 requestChatCompletions
  ├─ extractModelText → parseReplyCandidates → cleanReplyCandidates
  └─ sendResponse({ok:true, replies:[...]})
        ↓
content.js → showDraftPanel(replies, editor)
```

## 关键文件职责

| 文件 | 职责 |
|---|---|
| `manifest.json` | 扩展元数据、权限、入口注册 |
| `background.js` | 设置、Provider 选择、Prompt 构造、LLM 请求、响应解析、候选清洗 |
| `content.js` | DOM 注入、推文抽取、文本框定位、草稿窗 UI、填入 X 编辑器 |
| `content.css` | `.akiii-ai-button` / `.akiii-toast` / `.akiii-draft-panel` 样式 |
| `options.html` | 独立设置页（玻璃拟态 + 初音风 + 强哥头像） |
| `options.js` | 加载/保存 `chrome.storage.local`，`fk` 开头 Key 自动切 API2D |
| `tests/manifest.test.mjs` | 断言无 popup，只有 `options_page` |
| `tests/background.test.mjs` | vm 沙箱跑 background.js，验证 HTML 错误与 3 条候选清洗 |
| `tests/content-js.test.mjs` | 静态检查 content.js 关键函数的结构（dialog 优先级、targets 顺序） |
| `tests/content-css.test.mjs` | 静态检查 CSS 规则（候选按钮等宽、textarea 限宽） |

## 关键运行机制（防退化清单）

这些机制是 v2.0 用真实 bug 换来的，不要"顺手优化"掉。

1. **草稿窗一次必须 3 条**，每条独立 textarea + 独立「复制」「填入 X」按钮，**绝不自动发送**
2. **填入 X 不能硬替换编辑器内容**
   - 已踩坑：`selectNodeContents(editor) + execCommand('delete') + insertNode` 会让 X 的 React/Draft 状态错乱，文本"看得到但删不掉/没法继续编辑"
   - 现在的做法（`content.js` 482–516 行）：
     1. 先 `tryPasteEvent` — 构造 `DataTransfer + ClipboardEvent('paste')`，让 X 自己处理
     2. 失败再 `tryInsertTextCommand` — `document.execCommand('insertText', false, text)`
     3. 都失败 → 复制到剪贴板 + Toast 提示用户手动粘贴
   - 想"再聪明一点"前先把这段注释看完
3. **HTML / 非 JSON 响应必须当配置错误抛出**
   - `readJsonResponse`（`background.js`）会检测 `text/html` 或开头是 `<`，直接抛"接口返回的是 HTML 页面，不是 OpenAI 兼容 JSON。Base URL 可能填成了网站首页/控制台地址"
   - **绝不**退化成固定兜底回复，否则用户察觉不到自己 Base URL 填错
   - 测试 `background.test.mjs` 第一条用例就是断言这点
4. **`fk` 开头 Key 自动切 API2D**
   - `getEffectiveProvider`（`background.js`）和 `normalizeProviderByKey`（`options.js`）双层兜底
   - 减少新手把 API2D Key 配在 OpenAI 接口上的报错
5. **中英文检测纯靠正则，不要依赖用户手选**
   - `detectTweetLanguage`（content.js 39–51 行）：去掉 URL/@/$、看 CJK 数量 vs 拉丁单词数量
   - 检测结果通过 `payload.language` 传给 background；`buildInstructions` 据此切换长度规则与回复语言
6. **多条候选必须 JSON 数组输出 + 三次重试**
   - `generateReplies` 最多 3 轮，每轮在 instructions 里追加"上一次输出不合格"提示
   - 解析顺序：`tryParseReplyJson` → `splitReplyText`（兼容编号/项目符号）
7. **候选清洗管线一项都不能少**
   - `cleanReply` → `dedupeRepeatedText`（处理同一句复制 2/3/4 遍）→ `stripNoise`（去 ``` / Markdown 标题 / 回复：前缀 / HTML 实体）→ `maybeRepairMojibake`（修复 UTF-8 被当 Latin-1 读的乱码）→ 长度截断 → 去结尾句号
   - 禁词命中或 `looksLikeBrokenText` 命中 → 整条丢弃
8. **`额外提示词` 只是风格参考**
   - `buildInstructions` 里写死："忽略其中的回复数量、标题、分组、输出格式；如果冲突，以本次数量规则和输出格式为准"
   - 用户在 options 的 `customPrompt` 输入再炸裂的多段 prompt，都不允许覆盖"3 条 / JSON 数组 / 不带前缀"这三件事

## 设置项（`DEFAULT_SETTINGS`）

定义在 `background.js` 顶部，`options.js` 里也复制了一份，两边必须同步。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `provider` | `openai_responses` | `openai_responses` 走 `/v1/responses`；`chat` / `api2d` 走 `/v1/chat/completions` |
| `apiKey` | `""` | `sk-` / `sk-proj-` → OpenAI 官方；`fk` → 强制走 API2D |
| `model` | `gpt-4.1-mini` | 字符串透传给模型 |
| `apiBase` | `https://api.openai.com/v1` | 必须以 `/v1` 结尾，不能填首页 |
| `api2dBase` | `https://oa.api2d.net/v1` | 同上 |
| `defaultLanguage` | `zh` | `zh` / `en`；实际还会被 `detectTweetLanguage` 覆盖 |
| `defaultStyle` | `sharp` | 唯一一档，options 保存时强制写入，不要扩 |
| `maxChineseChars` | `24` | 中文输出软上限，最终截断阈值 `+18` |
| `maxEnglishWords` | `22` | 英文输出软上限，最终截断阈值 `+8` |
| `bannedWords` | 默认 19 个 | 逗号或换行分隔；命中即丢弃整条候选 |
| `projectHandle` | `""` | 默认项目方 @，仅在原推确实提到项目时才用 |
| `customPrompt` | `""` | 风格/人设参考；不能覆盖数量/格式硬规则 |
| `debugMode` | `false` | 开启后 `globalThis.__AKIII_DEBUG__ = true`，`log()` 才生效 |

## 常用命令

```bash
# 跑测试（项目没有 package.json，直接用 Node 原生 test runner）
# Node 22 的 --test 不展开目录，必须显式给文件 glob
node --test tests/*.test.mjs

# 单独跑某一个测试
node --test tests/background.test.mjs
```

**安装/加载到 Chrome：**
1. `chrome://extensions/`
2. 右上角开「开发者模式」
3. 「加载已解压的扩展程序」→ 选这个目录
4. 改完代码点扩展卡片上的「刷新」按钮，再到 X 页面强刷（Ctrl+F5）

**调试：**
- options 勾选「开启调试日志」并保存
- `chrome://extensions/` 找到本扩展 → 「service worker」打开 DevTools
- 看 `[X Reply]` 前缀的日志（`log()` 函数受 `debugMode` 控制，不会污染普通用户）

## 改动前的强制验证清单

任何非纯文档改动落地前都要全过：

- [ ] `node --test tests/*.test.mjs` 全绿
- [ ] Chrome 装载新版本，时间线点 `AI回` 走通一次（中文推文）
- [ ] 回复弹窗里点 `AI填入` 走通一次（英文推文）
- [ ] 草稿窗 3 条候选齐全、可编辑、复制/填入按钮都能工作
- [ ] 故意把 `apiBase` 改成 `https://api.openai.com`（去掉 `/v1`）或网站首页，确认报"Base URL 可能填成了首页"而**不是**显示固定兜底句
- [ ] options 页保存后，`chrome.storage.local` 里能看到所有字段
- [ ] 没有 `console.log` 漏到生成路径上（要用 `log()`）

## 绝对不要

- **不要加 popup**。`manifest.test.mjs` 会断言无 `default_popup`、`options_page === "options.html"`。点击图标必须打开独立 options 页
- **不要把 `defaultStyle` 扩成多选**。代码里 `STYLE_MAP` 只有 `sharp`，options 保存时也强制写 `sharp`。要扩就先动 `STYLE_MAP` 和 options 表单，且更新测试
- **不要给输出默认加 emoji**。`buildInstructions` 里写了"不要使用 emoji，除非原推强烈需要"，模型自己判断
- **不要绕过 `log()` 直接 `console.log`**。生成路径上多余日志会污染 Service Worker 控制台，让线上排查更难
- **不要收紧 `host_permissions`**。`https://*/*` + localhost 是给"任意兼容 Chat Completions 接口"留的口子；收紧会让 API2D 之外的中转/自建网关用不了
- **不要重写填入 X 的逻辑回到 `selectNodeContents`**。先看 `content.js` 第 482–516 行的注释
- **不要把 `额外提示词1.txt` / `额外提示词2.txt` 当成生产 prompt 用**。它们是用户的灵感库，真正生效的 prompt 在 `buildInstructions`

## 作者署名（固定）

- options.html hero：`作者：@iBigQiang，@Guomin184935`
- 草稿窗副标题（`content.js` 543 行）：同上
- 改 UI 时不要顺手删掉

## 相关文档

- `README.md` — 终端用户视角的 v2.0 说明
- `docs/DEVLOG.md` — 开发日志（最新版本在最前）
- `docs/开发及迭代方案调研报告/` — 每次大改前的方案文档
- `tasks/todo.md` — 当前迭代的可勾选任务清单
