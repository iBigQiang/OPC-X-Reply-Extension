# DEVLOG — X 推文互动回复器

> 格式约定：最新版本在最前。每条迭代包含「确定方案 / 实施细节 / 状态」三段。
> v1.x 早期版本没有 DEVLOG 沉淀，无法精确回填，保留占位以备后续考古。

---

## v2.1.4 — 2026-05-19 — hero 区作者超链接去样式 + 背景图替换收尾 + section-title 图标 lucide 化 + 修复 API Key 泄露事故

**确定方案**

v2.1.1 把作者署名升级成「强子手记 @iBigQiang & Akiii @Guomin184935」并给两个名字加了 X 主页超链接。但 `<a>` 在 options 玻璃拟态背景下默认是浏览器蓝 + 下划线，跟周围深青/白文字割裂感强。本次去掉两个超链接的视觉效果但保留 `href` 可点。同时收尾用户已经在做的视觉调整：背景图从 `img/akiii_bg.jpg` 换成 `img/options_bg.png`（强哥拍的新底图），并把暗化叠加层的 alpha 从 .70/.92 调到 .20/.4，让新背景图更显出来。

设置页 3 个 section-title 左侧的占位图标本来用的是 Unicode 字符 `✎` / `⌁` / `Aa`：`⌁`（电流符号）在多数字体里渲染成 tofu，`Aa` 跟「回复设置（参数面板）」语义对不上。本次替换成 lucide 风格的 inline SVG：`square-pen` / `plug` / `sliders-horizontal`，currentColor 继承青色高亮，扩展无需联网。

另外修复一个**严重安全事故**：GitGuardian 检出本仓库 v2.1.0 / v2.1.3 提交的 `docs/开发及迭代方案调研报告/迭代需求1.md` 第 14 行硬编码了一把真实 DeepSeek API Key（具体值在邮件正文中，本文档内不再复述），随 push 被发布到公网。问题根因：用户当时把命令行启动 Claude Code 用的 ANTHROPIC_AUTH_TOKEN 配置示例（含真实 Key）原样粘贴到迭代需求 markdown 里作为「自定义协议」示例，没意识到该目录会随 commit 进入公网仓库。本次做四件事彻底闭环：当前工作树脱敏、`.gitignore` 永久排除整个 `docs/开发及迭代方案调研报告/`、`git rm -r --cached` 让 git 不再追踪、`git filter-repo` 重写所有历史 commit 抹掉该目录、force push 覆盖远端。

**实施细节**

- `options.html`
  - `<style>` 段新增 `.author a` / `.author a:visited` / `.author a:hover` / `.author a:focus`：`color: inherit; text-decoration: none;` + hover 时 `opacity: .85` 给一点反馈
  - **只动 hero 区作者那一行**（用户明确要求），footer 的「设计与开发」链接保持现状
  - 用户已做的背景图替换 / 暗化层调淡保留：`img/akiii_bg.jpg` → `img/options_bg.png`，渐变 alpha `.70/.92` → `.20/.4`
  - 3 个 `.section-title .icon` 占位字符替换为 inline SVG：
    - 「回复内容（可编辑）」 `✎` → lucide `square-pen`（方框 + 笔），更精准表达「可编辑文档」语义
    - 「API 设置」 `⌁` → lucide `plug`（插头），表达「接口/连接器」，避开 `⌁` 在多数字体下 tofu 的问题
    - 「回复设置」 `Aa` → lucide `sliders-horizontal`（三条横向滑块），表达「参数面板」
  - `<style>` 段新增 `.section-title .icon svg { width: 14px; height: 14px; display: block; }`，控制 SVG 在 24×24 玻璃方块容器内的尺寸；外层容器、底色渐变、青色 currentColor 保持不变
- `content.css`
  - 用户已做的草稿窗背景图替换 / 暗化层调淡保留：`img/akiii_bg.jpg` → `img/options_bg.png`，alpha `.62/.88` → `.2/.4`
- `manifest.json`
  - v2.1.3 → v2.1.4
  - 用户已做的 `web_accessible_resources` 同步更新（删 `akiii_bg.jpg` 加 `options_bg.png`）保留
- `README.md`
  - 用户已做的署名升级 + 文件结构里背景图重命名保留
- 图片资源
  - `img/akiii_bg.jpg` 删除（被 `options_bg.png` 替代）
  - `img/miku_bg.svg` 删除（v2.0 起从未在任何代码里被引用，仅出现在 manifest 的 web_accessible_resources 和 README 文件结构里；本次顺手清理三处冗余）
  - `img/options_bg.png` 新增（已纳入打包）
  - `img/options_bg2.png` 保持 untracked 本地备份状态，不进仓库也不进 zip
- `pack.ps1`
  - img/ 打包逻辑加白名单：`options_bg<数字>.png` 模式的备选图不进 zip（跟现有 `.txt` 白名单"含数字=备份"风格一致）
- `manifest.json` / `README.md`
  - 跟着 `miku_bg.svg` 删除，从 `web_accessible_resources` 和 README 文件结构里同步移除引用
- `OPC-X-Reply-Extension.zip` 由 `bash pack.sh` 重打（3530 KB）
- **API Key 泄露事故修复**
  - `docs/开发及迭代方案调研报告/迭代需求1.md:14` 真实 Key 脱敏为 `sk-******************`
  - `.gitignore` 加规则：
    - `docs/开发及迭代方案调研报告/`（整个目录从此不进仓库；附三行注释说明历史教训）
    - 防御性规则：`*.env` / `.env.*` / `secrets.*` / `*.secret` / `*.key` / `*.pem` / `*credentials*` / `*api_key*` / `*apikey*`
  - `git rm -r --cached docs/开发及迭代方案调研报告/` —— 让 git 不再追踪这 6 个 markdown，本地文件保留（用户的迭代调研草稿，本地有用）
  - `git filter-repo --path "docs/开发及迭代方案调研报告/" --invert-paths` 重写所有历史 commit，抹掉该目录在 17 个 commit 中的所有版本；所有 commit SHA 改变
  - `git push --force-with-lease origin main` 把清理后的历史推到 GitHub，覆盖远端被泄露的版本

**状态**

代码已交付。`node --test tests/*.test.mjs` 41/41 全绿（本次只改 CSS / HTML 图标节点 / 版本号 / 文档，未触及任何被测代码路径）。Chrome 实测项：装载新 zip → 打开 options → hero 区作者那一行的「强子手记」「Akiii」应跟普通文字一样无下划线无蓝色（鼠标 hover 微微变淡）；新背景图应正常显示；3 个 section-title 左侧应能看到清晰的 lucide 线条图标（青色，宽高 14px）；footer 的链接仍是浏览器默认样式（不在本次范围）。

**用户必须手动跟进**：到 https://platform.deepseek.com 撤销已泄露的 Key（具体值在 GitGuardian 邮件中）。即使 GitHub 历史已彻底重写，第三方爬虫和搜索引擎缓存可能已抓取该 Key 副本，仅靠重写历史不能阻止他人盗用。撤销动作只能在 DeepSeek 平台完成，扩展和仓库都帮不上忙。

---

## v2.1.3 — 2026-05-19 — Base URL 智能自动补全归一化（学习 Cherry Studio）

**确定方案**

v2.1.0 引入的 8 渠道接口对用户输入粒度敏感：OpenAI 类必须填到 `/v1`、Anthropic 必须填到根域名、Gemini 必须填到 `/v1beta`，填错粒度就会拼出错误 URL（双 `/v1` 或缺 `/v1`）。本次参考 [Cherry Studio 服务商配置](https://docs.cherry-ai.com/pre-basic/settings/providers) 的兼容方案，做"用户填啥粒度都能拼对"的归一化升级。子代理联网核对了 6 个官方 endpoint 路径与 Cherry Studio 的 `#` 终止符规则，详细方案见 `docs/开发及迭代方案调研报告/2026-05-19-v2.1.3-Base-URL-自动补全归一化.md`。

**比 Cherry Studio 多走一步**：Cherry Studio 不识别"已含 /v1"，靠用户用 `#` 显式声明；本扩展面向 X 用户，让他们记 `#` 太重，所以默认就**智能识别**根域名 / `/v1` / `/v1/` / 完整 endpoint，`#` 仅作为「保留逃生舱」用于走 Azure 风格特殊路径。

**实施细节**

- `options.js`
  - 重写 `buildEndpointPreview`：所有依赖（`PATH_SPEC` / `escapeRe` / 归一化算法）都内联到函数闭包内，保证 `tests/endpoint-preview.test.mjs` 的 `new Function` 抽函数测试仍可用
  - `PROVIDER_BASE_HINTS` 8 条全部升级文案，告知用户可填根域名或带 /v1，提示 `#` 终止符
- `background.js`
  - 新增顶层 `PROVIDER_PATH_SPEC` + `escapeRegex` + `buildFinalEndpoint`，与 `options.js` 的 `buildEndpointPreview` 同款逻辑
  - 删除 v2.1.0 残留的死代码 `buildRequestUrl`
  - 重构 `callModel`：custom 渠道保持完全透传（仅去掉末尾 `/` 或 `#`），其他渠道用 `buildFinalEndpoint` 计算 `requestUrl` 后传给请求函数
  - 重构 `requestOpenAIChat` / `requestOpenAIResponses` / `requestGemini` / `requestAnthropic`：均改为接收必填的 `requestUrl` 参数，不再内部拼接路径；删除 `urlOverride` 二义性
- `options.html`
  - Base URL 输入框下方 fallback `apiBaseHint` 文案升级为"支持填根域名或带 /v1，自动补全；末尾加 # 强制完整 URL"
- `tests/endpoint-preview.test.mjs` 新增 10 条用例
  - openai_chat 根域名自动补、完整 endpoint 透传（含大小写）
  - openai_responses 根域名补全
  - anthropic 带 /v1 不重复、完整 endpoint 透传
  - gemini 根域名补全、完整 endpoint（含 model）透传
  - newapi / sub2api 根域名补全
  - `#` 终止符跨 provider 透传（含 Azure 风格路径）
  - `/v1$` 边界匹配不误判 `/v1beta`
  - base 为空给占位
- `tests/background.test.mjs` 新增 5 条用例覆盖实际 fetch URL
  - anthropic 填根域名 / 填带 /v1 各自正确
  - openai_chat 填根域名自动补 /v1/chat/completions
  - `#` 终止符强制透传 Azure 风格路径
  - gemini 填根域名自动补 /v1beta/models/{model}:generateContent
- `manifest.json` v2.1.2 → v2.1.3，description 补「Base URL 智能自动补全（根域名 / 带 /v1 / 完整 endpoint / # 终止符 都能识别）」
- `OPC-X-Reply-Extension.zip` 由 `bash pack.sh` 重打
- **不动**：内容脚本、CSS、UI 布局、`PROVIDER_DEFAULTS` 默认值（保持向后兼容现有用户配置）
- 不触发 Impeccable 全审（后端逻辑 + 文案微调），不跑 /btw（属"补强已有特性的兼容性"）

**状态**

代码与测试已交付。`node --test tests/*.test.mjs` 41/41 全绿（原 25 + 新 16）。Chrome 实测项：装载新 zip → options 页 → 试三种粒度（根域名 / 带 /v1 / 带 /v1/）切换各渠道、实时预览 URL 应一致；点 AI回 实际生成应成功；故意配错的 base 仍能报"Base URL 可能填成了首页"。

---

## v2.1.2 — 2026-05-19 — API Key 输入框加密码可见性切换（小眼睛）

**确定方案**

用户配置 API Key 经常因为粘贴时多了空格、漏了字符或 fk/sk 前缀混淆而保存了一个「看不见的错」。`<input id="apiKey" type="password">` 永远以圆点显示，没法快速核对粘进去的内容。本次给 API Key 输入框右端加一个小眼睛切换按钮，点击在 `password` ↔ `text` 之间切换，**默认仍是 `password`**，不退化安全默认。详细方案见 `docs/开发及迭代方案调研报告/2026-05-19-v2.1.2-API-Key-可见性切换.md`。

**实施细节**

- `options.html`
  - `<style>` 段末尾新增 `.input-with-toggle` / `.visibility-toggle` 规则：wrapper 相对定位、按钮绝对定位到右内侧 6px，圆角 10px、透明背景、hover 变青蓝、`focus-visible` 给青色 outline 环
  - `.input-with-toggle > input` 单独加 `padding-right: 44px`（不动全局 input 样式，不影响其他字段）
  - 用 `aria-pressed="true"` 切两个 inline SVG（`.eye-open` / `.eye-off`）的 display，避免外部图标资源
  - API Key input 包到 `<div class="input-with-toggle">` 内，紧跟一个 `<button id="apiKeyToggle" type="button" aria-pressed="false" aria-label="显示 API Key">`，两个 SVG（open-eye / eye-off）作为子元素
- `options.js`
  - 末尾追加 `$("apiKeyToggle").addEventListener("click", ...)`：判断当前 input.type，切到 password / text，同步 `aria-pressed` 与 `aria-label`
- `tests/options-html.test.mjs`（**新增**，5 条用例）
  - 断言 `<input id="apiKey">` 默认 `type="password"` + `autocomplete="off"`
  - 断言 wrapper 结构包住 input 与切换按钮
  - 断言切换按钮初始 a11y 属性：`type="button"` / `aria-pressed="false"` / `aria-label="显示 API Key"`
  - 断言 CSS 段有相关规则且按 `aria-pressed` 切 SVG
  - 断言 options.js 绑定了 click 事件并切 type / aria-pressed / aria-label
- `manifest.json` v2.1.1 → v2.1.2，description 末尾补「API Key 输入框支持密码可见性切换」
- `OPC-X-Reply-Extension.zip` 由 `bash pack.sh` 重打
- **不动** background.js / content.js / content.css / 任何 v2.1.0 引入的 provider 逻辑；CLAUDE.md 不动（不涉及新规则）
- 不触发 Impeccable 全审（局部交互增强，未改页面结构 / 信息架构 / 配色 / 排版），不跑 /btw（补丁级）

**状态**

代码与测试已交付。`node --test tests/*.test.mjs` 25/25 全绿（原 20 + 新 5）。Chrome 实测项：装载新 zip → 打开 options → 点击 API Key 右端小眼睛，确认在「圆点」与「明文」之间切换、aria-label 变化、键盘 Tab 顺序正常，并目视确认按钮跟玻璃拟态风协调、hover/focus 状态友好。

---

## v2.1.1 — 2026-05-19 — v2.1.0 收尾微调（作者署名统一 + provider 文案 + Base URL 上移）

**确定方案**

v2.1.0 commit (`0fba933`) 在 push 之后又陆续手动调了 4 个文件：作者署名口径升级、`provider` 选项加「兼容」前缀、Base URL 输入框位置上移、`迭代需求1.md` 末尾误留空 `<a>`。这些散落改动需要收拢成一个补丁版本走完 `/ship`，避免 zip 与代码版本号脱节。同时把 `CLAUDE.md`「作者署名（固定）」段落同步到最新口径，杜绝未来被回退。详细方案见 `docs/开发及迭代方案调研报告/2026-05-19-v2.1.1-收尾微调.md`。

**实施细节**

- `content.js` 543 行草稿窗副标题：`作者：强子手记 & Akiii` → `作者：强子手记 @iBigQiang & Akiii @Guomin184935`（补回 @ handle）
- `README.md` 来源与致谢段：`@iBigQiang，@Guomin184935` → `强子手记 @iBigQiang & Akiii @Guomin184935`
- `options.html` hero（298 行）保持 v2.1.0 push 后的「带 X 链接的强子手记 + Akiii」版本，无需再改
- `options.html` footer（399 行）保持「由 强子手记 & Akiii 设计与开发」精简别名版（不加 @ handle —— 跟「作者」语义不同）
- `options.html` provider select 三项保留「兼容 OpenAI-Chat / 兼容 OpenAI-Response / 兼容 Anthropic」前缀，表达"用同协议接入同类接口"的兼容含义
- `options.html` Base URL 输入框 + 预览节点保持在 API Key **之前**（v2.1.0 push 后的位置），让用户先确定 endpoint 再贴 Key
- `docs/.../迭代需求1.md` 末尾删除 `<a href="" target="_blank"></a>` 与多余空行
- `CLAUDE.md`「作者署名（固定）」段落重写：明确三处统一口径，并补一句 footer 与「作者」语义不同
- `manifest.json` v2.1.0 → v2.1.1（description 仍是 v2.1 的 8 渠道说明，无需重写）
- `OPC-X-Reply-Extension.zip` 由 `bash pack.sh` 重打
- 不动 `background.js` / `options.js` / `content.css` / 任何测试代码（已验证 `tests/` 无作者署名字符串断言）
- 不触发 Impeccable 多子技能审查（本次只是文案 + 位置微调，无新页面、无新交互），不跑 /btw（补丁级，未达"中大型迭代"门槛）

**状态**

代码与文档已交付。`node --test tests/*.test.mjs` 预期仍 20/20 全绿（本次未改任何被测代码路径）。Chrome 实测项降级为：装载新 zip 后打开 options 与草稿窗，目视确认三处作者署名口径一致，并验证 v2.1.0 已经通过的 8 渠道生成 / Base URL 实时预览仍正常。

---

## v2.1.0 — 2026-05-19 — 多渠道接口扩展 + Base URL 预览 + 配置缓存 + UI 微调

**确定方案**

v2.0 只支持 3 档接口（`openai_responses` / `chat` / `api2d`），无法直接接入 Gemini、Anthropic、New API、Sub2API 等主流网关；同时回复弹窗的「AI填入」按钮文字左偏、草稿窗右上角 × 偏上偏左，是 v2.0 上线后用户实测发现的视觉 bug。本次按 `docs/开发及迭代方案调研报告/2026-05-19-迭代需求1-多渠道接口扩展.md` 把接口扩到 **8 档** 并增加「每个渠道独立配置缓存 + 输入即变的 Base URL 预览」，同时修掉 3 处 UI bug。

**实施细节**

- `background.js`
  - 新增常量 `PROVIDER_IDS` / `PROVIDER_DEFAULTS`：8 个 provider 的默认 Base URL / 默认模型/ 子协议
  - 新增 `migrateSettings`：老用户 `provider: "chat"` → `openai_chat`；老顶层 `apiKey/model/apiBase/api2dBase` 自动回填到 `providerProfiles`
  - 新增 `getActiveProfile`：根据 `effective provider` 读对应 profile，顶层字段作为兜底
  - 重命名 `requestChatCompletions` → `requestOpenAIChat`，新增 `requestOpenAIResponses` / `requestGemini` / `requestAnthropic` 三条独立路径
  - `callModel` 改 8-way switch；`custom` 走子协议（`openai_chat` / `openai_responses` / `anthropic` / `gemini`），把用户填的完整 endpoint 直接作为 URL 透传
  - `extractModelText` 增加 Anthropic（`content[].text`）和 Gemini（`candidates[0].content.parts[].text`）两个分支
  - `explainApiError` 为 Anthropic / Gemini 加上 401 中文解释
  - `getEffectiveProvider`：`fk` 开头 Key 仍只切 api2d，**不会**误识别 sub2api / newapi
- `options.html`
  - 接口类型 select 扩到 8 项（OpenAI-Chat / OpenAI-Response / Gemini / Anthropic / New API / Sub2API / api2d / 自定义）
  - 删除 v2.0 的「API2D Base URL」独立输入框 — 切换到 api2d 时 Base URL 自动从 profile 缓存回填
  - 新增 `customProtocolRow`：选择「自定义」时显示子协议下拉（OpenAI-Chat / OpenAI-Response / Anthropic / Gemini，默认 OpenAI-Chat）
  - Base URL 输入框下方新增 `apiBasePreview` 节点（灰度等宽字体），实时显示完整 endpoint
  - Base URL hint 文案按 provider 动态变（`PROVIDER_BASE_HINTS`）
- `options.js`
  - 新增 `providerProfiles` 内存模型 + `chrome.storage.local` 双写：每个 provider 一份 `{ apiKey, model, apiBase, customProtocol? }`
  - 新增 `buildEndpointPreview`：与 `background.js` 的 `buildRequestUrl` 一一对应；任意 `provider / model / apiBase / customProtocol` 输入即触发预览刷新
  - `onProviderChange`：切换 provider 前先把当前表单写回旧 profile，再从新 profile 读字段回填表单
  - `save`：把当前表单写回 `providerProfiles[currentProvider]`，再把当前 profile 的字段同步到顶层 `apiKey/model/apiBase`（兼容 background 的兜底读法），最后整对象 `storage.local.set`
  - `fk` 开头 Key 在 save 时自动切到 api2d profile 并切换激活 provider，与 v2.0 保持一致
- `content.css`
  - `.akiii-ai-button`：新增 `display: inline-flex; align-items: center; justify-content: center; text-align: center;` — 修复评论框/弹窗内 AI 填入按钮文字左偏
  - `.akiii-draft-close`：改成 `display: inline-grid; place-items: center; padding: 0;` — 修复草稿窗右上角 × 偏上偏左
- `tests/`
  - `background.test.mjs`：在已有 2 条用例外，新增 4 条用例覆盖 **anthropic 走 `/v1/messages` + `x-api-key` 头 + 解析 `content[].text`**、**gemini 走 `/models/{model}:generateContent` + `x-goog-api-key` 头**、**newapi 路由到 OpenAI Chat**、**老 `provider: "chat"` 自动迁移到 `openai_chat`**
  - `content-css.test.mjs`：新增 2 条断言覆盖 AI 按钮 flex 居中、× 按钮 grid 居中
  - 新增 `tests/endpoint-preview.test.mjs`：8 个用例覆盖 `buildEndpointPreview` 各 provider 的 URL 拼接、末尾 `/` normalize、空 model 占位符、custom 透传
- `manifest.json` 升 v2.1.0，描述补充 8 个渠道说明
- `OPC-X-Reply-Extension.zip` 由 `bash pack.sh` 重打

**状态**

代码与测试已交付。`node --test tests/*.test.mjs` 20/20 全绿（含新增 14 条）。Chrome 实测验证清单（按 `CLAUDE.md`「改动前的强制验证清单」）由用户在装载新版本扩展后跑一遍：8 个渠道任选 2-3 个跑通生成、Base URL 预览实时更新、provider 切换时配置自动回填、3 处 UI bug 截图复测全消、HTML 响应仍能正确报"Base URL 可能填成了首页"。

---

## v2.0.2 — 2025-05-18 — Ship 打包流程固化

**确定方案**

迭代过程中发现：远端仓库根目录有一份 `OPC-X-Reply-Extension.zip` 供普通用户直接下载使用，但项目没有任何"每次迭代后必须重打 zip"的强约束，容易把"代码已更新、zip 还是旧的"这种 bug 带到生产。把打包步骤固化进 `CLAUDE.md` 的 /ship 收尾流程，并落地一个 `pack.sh` 脚本，让每次迭代结束 push 前都重新生成 zip。

**实施细节**

- 新增 `pack.sh`（项目根）— 一键打包：`manifest.json` + 4 个 js/css/html + `img/` + `README.md` + `禁用词.txt` + `额外提示词.txt`，明确**不**打入 `CLAUDE.md` / `docs/` / `tasks/` / `tests/` / `.gitignore` / `pack.sh` / 私有灵感库（`额外提示词1.txt` / `额外提示词2.txt`）
- `CLAUDE.md` 新增「/ship 收尾流程（本项目专用）」小节，明确"push 前必跑 `bash pack.sh`，把新 zip 一起提交，老 zip 必须覆盖"
- `CLAUDE.md`「常用命令」加入 `bash pack.sh`
- `CLAUDE.md`「改动前的强制验证清单」末尾追加一条"重打 zip 并随 commit 提交"
- 本次执行 `bash pack.sh` 生成新 zip 覆盖远端旧 zip

**状态**

已交付。新 zip 与文档一起进入新 commit。

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
