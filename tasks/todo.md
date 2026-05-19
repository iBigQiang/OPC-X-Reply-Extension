# v2.1.2 — API Key 输入框加密码可见性切换（小眼睛）

## 任务清单

- [x] 读完背景：CLAUDE.md / DEVLOG / 现有 options.html style 系统 / options.js 事件绑定模式
- [x] 与用户确认 3 个开放问题（范围只给 API Key / 双 SVG 经典眼睛 + 闭眼斜杠 / 不走 Impeccable）
- [x] 写方案文档 `docs/开发及迭代方案调研报告/2026-05-19-v2.1.2-API-Key-可见性切换.md`
- [x] `options.html` `<style>` 段末尾加 `.input-with-toggle` / `.visibility-toggle` 规则
- [x] `options.html` API Key input 包到 wrapper 内，加切换按钮 + 两个 SVG
- [x] `options.js` 末尾绑定 `#apiKeyToggle` click 事件，切 type + 同步 aria-pressed / aria-label
- [x] 新增 `tests/options-html.test.mjs`：5 条静态断言
- [x] 跑 `node --test tests/*.test.mjs`：25/25 全绿（原 20 + 新 5）
- [x] `manifest.json` 升 v2.1.2，description 补一句
- [x] `docs/DEVLOG.md` 追加 v2.1.2 章节
- [ ] `bash pack.sh` 重打 `OPC-X-Reply-Extension.zip`
- [ ] `git add` + `git commit` + `git push`（走 `/ship`）
- [ ] **Chrome 实测（用户跑）**：装载新 zip → options → 点击 API Key 右端小眼睛 → 圆点 ↔ 明文切换 → hover/focus 视觉 → 键盘 Tab 顺序

## 摘要

给 options 页 API Key 输入框右端加密码可见性切换按钮（小眼睛），默认仍是 `password`，点击切换到 `text`，再点切回。涉及 options.html 加 wrapper + 按钮 + 两个 inline SVG（open-eye / eye-off）+ CSS 玻璃拟态适配，options.js 末尾加 click 事件绑定，新增 tests/options-html.test.mjs 5 条静态断言。不动后台 / 内容脚本 / 任何 v2.1.0 引入的 provider 逻辑。

## 复盘

待 push 完成后填写。
