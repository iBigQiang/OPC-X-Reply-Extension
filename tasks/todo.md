# v2.1.3 — Base URL 智能自动补全归一化（学习 Cherry Studio）

## 任务清单

- [x] 读完背景：CLAUDE.md / DEVLOG / 现有 buildEndpointPreview 与 background.js 拼接逻辑 / 现有 25 条单测覆盖面
- [x] 子代理联网调研：Cherry Studio Base URL 规则 + 6 个官方 endpoint 路径核对 + DeepSeek Anthropic 入口确认
- [x] 写方案文档 `docs/开发及迭代方案调研报告/2026-05-19-v2.1.3-Base-URL-自动补全归一化.md`
- [x] `options.js` 重写 `buildEndpointPreview`：内联 PATH_SPEC + 归一化算法，支持根域名 / /v1 / /v1/ / 完整 endpoint / # 终止符
- [x] `background.js` 新增 `buildFinalEndpoint`（同款逻辑），删除死代码 `buildRequestUrl`，重构 4 个 request 函数和 `callModel`
- [x] `options.js` `PROVIDER_BASE_HINTS` 升级文案告知用户新的兼容能力
- [x] `options.html` fallback `apiBaseHint` 文案同步升级
- [x] `tests/endpoint-preview.test.mjs` 新增 10 条用例（根域名/v1/完整/`#`/边界）
- [x] `tests/background.test.mjs` 新增 5 条用例覆盖实际 fetch URL
- [x] 跑 `node --test tests/*.test.mjs`：41/41 全绿（原 25 + 新 16）
- [x] `manifest.json` 升 v2.1.3，description 补一句
- [x] `docs/DEVLOG.md` 追加 v2.1.3 章节
- [ ] `bash pack.sh` 重打 `OPC-X-Reply-Extension.zip`
- [ ] `git add` + `git commit` + `git push`（走 `/ship`）
- [ ] **Chrome 实测（用户跑）**：装载新 zip → options 页 → 三种粒度（根域名 / 带 /v1 / 带 /v1/）切换各渠道，实时预览 URL 应一致；任选 2-3 个渠道点 AI回 实际生成成功；故意配错的 base 仍能报"Base URL 可能填成了首页"

## 摘要

参考 Cherry Studio 的 Base URL 兼容方案，让 7 个标准 provider（openai_chat / openai_responses / gemini / anthropic / newapi / sub2api / api2d）都支持用户填根域名 / 带 /v1 / 带 /v1/ / 完整 endpoint 任一粒度，自动归一化到正确请求 URL；额外引入 Cherry Studio 风的 `#` 终止符作为「保留逃生舱」用于走 Azure 风格特殊路径。两侧（options.js 的 `buildEndpointPreview` 和 background.js 的 `buildFinalEndpoint`）共享同款算法。新增 15 条测试用例覆盖各 provider 的 3 种输入粒度 / 完整 URL 透传 / `#` 终止符 / 边界（`/v1$` 不误判 `/v1beta`）。删除 v2.1.0 残留的 `buildRequestUrl` 死代码。

## 复盘

待 push 完成后填写。
