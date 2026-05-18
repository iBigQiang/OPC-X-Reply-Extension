# DEVLOG — X 推文互动回复器

> 格式约定：最新版本在最前。每条迭代包含「确定方案 / 实施细节 / 状态」三段。
> v1.x 早期版本没有 DEVLOG 沉淀，无法精确回填，保留占位以备后续考古。

---

## v2.0.1 — 2025-05-18 — 文档底座补齐

**确定方案**

按 `~/.claude/CLAUDE.md` 全局规则要求，每次重启项目都要 `/newup`，每次迭代都要更新 `docs/DEVLOG.md`。v2.0.0 落地时只留了 `README.md`，没有 `CLAUDE.md` 也没有 `DEVLOG.md`，后续迭代的规则跑不通。本次只做文档底座，不动任何代码。

**实施细节**

- 新增 `CLAUDE.md`（项目根）— 项目专属规则、关键运行机制、避坑、命令、验证清单
- 新增 `docs/DEVLOG.md` — 开发日志，回填 v2.0.0 已知状态
- 新增 `docs/开发及迭代方案调研报告/2025-05-18-文档底座补齐.md` — 本次方案文档
- 新增 `tasks/todo.md` — 本次迭代任务清单 + 复盘
- 不动 `background.js` / `content.js` / `content.css` / `options.*` / `manifest.json` / `tests/`
- 不改 `README.md`，让"终端用户视角"与"AI/工程师视角"两份文档各司其职

**状态**

已交付。`node --test tests/*.test.mjs` 全绿，6 个用例全过（仅文档变动，无误伤面）。

---

## v2.0.0 — 2025-05-12 — 三条候选 + 玻璃拟态草稿窗（回填）

**确定方案**

v1.x 每次只生成 1 条回复直接填入，用户经常觉得"不够顺手就只能再点一次重新生成"。v2.0 改成一次生成 3 条候选，先进入可编辑草稿窗，用户挑一条改满意再点对应的「填入 X」。同时修一批 v1.x 的痛点：HTML 响应被错认成正常回复、API2D Key 配错 provider、X 编辑器填入后状态错乱。

**实施细节**

- `background.js`
  - 新增 `generateReplies(payload, count=3)`，最多 3 轮重试，每轮把"上一次输出不合格"追加到 instructions
  - 新增 `parseReplyCandidates` / `tryParseReplyJson` / `splitReplyText` / `cleanReplyCandidates`，先按 JSON 数组解析，再回退到编号/项目符号文本
  - `readJsonResponse` 检测 `text/html` 或开头 `<` 时直接抛"接口返回 HTML，Base URL 可能填成了首页"，**不再**退化成固定兜底回复
  - `getEffectiveProvider` 识别 `fk` 开头 Key 自动切 API2D；`explainApiError` 把 401 翻译成人话
  - 候选清洗：`dedupeRepeatedText` 压缩同一句复制 2/3/4 遍、`maybeRepairMojibake` 修 UTF-8 被当 Latin-1 读的乱码、`looksLikeBrokenText` 整条丢弃乱码
  - `requestResponses` 走 `/v1/responses`（OpenAI 官方新接口），`requestChatCompletions` 走 `/v1/chat/completions`（兼容/API2D）
- `content.js`
  - 新增 `showDraftPanel(replies, editor)` — 右下角玻璃拟态草稿窗，3 条候选独立 textarea + 复制 / 填入 X 按钮
  - 修 X 编辑器填入：移除 `selectNodeContents + 硬替换`（React/Draft 状态会错乱），改用 `tryPasteEvent`（构造 `DataTransfer + ClipboardEvent('paste')`）→ `tryInsertTextCommand`（`execCommand('insertText')`）→ 复制兜底
  - `getInsertTargets` 优先弹窗内 textbox，再退到调用者传入的 editor；`getBestTextbox` 优先 active dialog 内的活动元素
  - `extractTweetFromArticle` / `extractTweetFromDialog` 双路抽取，dialog 抽取去掉按钮/textarea/工具栏
  - `runWithButton` + `STATE.activeRequest` 单飞控制，防止用户连点
- `options.html` / `options.js`
  - 升级玻璃拟态 + 初音风渐变 + 强哥（`Qiangge.jpg`）作为 hero 头像
  - 字段集中：provider / apiKey / model / apiBase / api2dBase / defaultLanguage / maxChineseChars / maxEnglishWords / projectHandle / bannedWords / customPrompt / debugMode
  - `normalizeProviderByKey` 在保存时识别 `fk` 开头 Key 并自动切 API2D
  - `defaultStyle` 在 readForm 里强制写 `sharp`，对应 background 里唯一的 `STYLE_MAP`
- `manifest.json`
  - 改为 `manifest_version: 3`、`version: 2.0.0`
  - 点击 action 不再弹 popup，走 `chrome.action.onClicked` → `openOptionsPage`
  - `host_permissions` 保留 `https://*/*` + localhost，给兼容接口留口子
- `tests/`
  - `manifest.test.mjs` — 断言 `options_page === "options.html"` 且无 `default_popup`
  - `background.test.mjs` — `vm` 沙箱跑 `background.js`，断言 HTML 200 响应被识别为配置错误；断言 JSON 数组响应能产出 3 条清洗后候选
  - `content-js.test.mjs` — 静态结构检查 `getBestTextbox` 内的 dialog 优先级、`getInsertTargets` 的 targets 顺序
  - `content-css.test.mjs` — 静态检查 `.akiii-draft-panel` 等宽按钮变量、textarea `max-width: 500px`、grid `max-content`

**状态**

已交付。`README.md` 与 `manifest.json` 都标记为 v2.0.0。

---

## v1.x — 早期版本（信息缺失）

当时没有 DEVLOG 沉淀，代码里也没有版本变更说明。已知大致能力：一次生成一条回复直接填入；弹出式 popup 设置框；只有英文/中文一档默认风格。其余细节无法精确回填，保留此条目以备后续考古。
