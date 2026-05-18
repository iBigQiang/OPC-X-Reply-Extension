# v2.1.0 — 多渠道接口扩展 + Base URL 预览 + 配置缓存 + UI 微调

## 任务清单

- [x] 读完背景：`CLAUDE.md` / `DEVLOG.md` / `README.md`
- [x] 看 3 张 bug 截图，识别 UI 问题
- [x] 并行用子代理调研 Gemini / Anthropic / New API / Sub2API 官方协议
- [x] 完整读 `background.js` / `options.html` / `options.js` / `content.js` / `content.css`
- [x] 写方案文档 `docs/开发及迭代方案调研报告/2026-05-19-迭代需求1-多渠道接口扩展.md`
- [x] 与用户确认 4 个开放问题（命名、Sub2API 默认值、custom 子协议、anthropic-version）
- [x] 改 `background.js`：8-way provider 路由 + `migrateSettings` + `requestGemini` / `requestAnthropic` + `extractModelText` 多协议分支
- [x] 改 `options.html`：select 8 选项 + custom 子协议 select + Base URL 预览节点 + 删除 api2dBase 输入框
- [x] 改 `options.js`：`providerProfiles` 缓存 + `buildEndpointPreview` + 切换/保存逻辑
- [x] 改 `content.css`：`.akiii-ai-button` flex 居中 + `.akiii-draft-close` grid 居中
- [x] 改 `tests/background.test.mjs`：新增 4 条 provider 路由用例
- [x] 改 `tests/content-css.test.mjs`：新增 2 条 UI 居中断言
- [x] 新建 `tests/endpoint-preview.test.mjs`：8 条预览拼接用例
- [x] 跑 `node --test tests/*.test.mjs`：20/20 全绿
- [x] `manifest.json` 升 v2.1.0
- [x] `docs/DEVLOG.md` 追加 v2.1.0 章节
- [ ] **Chrome 实测**（用户跑）：装载新版扩展、8 个渠道任选 2-3 个跑通、3 处 UI bug 复测、provider 切换缓存校验、HTML 响应错误提示仍正确
- [ ] `bash pack.sh` 重打 `OPC-X-Reply-Extension.zip`
- [ ] `git add` + `git commit` + `git push`（走 `/ship`）

## 摘要

把 v2.0 的 3 档接口扩到 8 档（OpenAI-Chat / OpenAI-Response / Gemini / Anthropic / New API / Sub2API / api2d / 自定义），每档独立缓存配置，Base URL 输入即变实时预览，同时修掉 3 处 UI bug（AI 填入按钮文字左偏 × 2、草稿窗 × 偏位 × 1）。`background.js` 主要新增多协议路由与 `migrateSettings`，`options.js` 主要新增 `providerProfiles` + `buildEndpointPreview`，`content.css` 改两条规则。

## 复盘

待 Chrome 实测通过后填写。
