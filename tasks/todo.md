# v2.1.1 — v2.1.0 收尾微调（作者署名统一 + provider 文案 + Base URL 上移）

## 任务清单

- [x] 读完背景：`CLAUDE.md` / `DEVLOG.md` / `README.md` / v2.1.0 未提交 diff
- [x] 与用户确认两个关键问题（收尾成 v2.1.1 / 三处统一作者署名口径）
- [x] 写方案文档 `docs/开发及迭代方案调研报告/2026-05-19-v2.1.1-收尾微调.md`
- [x] 清理 `docs/.../迭代需求1.md` 末尾空 `<a>` 与多余空行
- [x] `content.js` 543 行草稿窗副标题补回 @ handle，统一口径
- [x] `README.md` 来源与致谢段升级到新口径
- [x] `CLAUDE.md`「作者署名（固定）」段重写到新口径
- [x] `manifest.json` 升 v2.1.1
- [x] `docs/DEVLOG.md` 追加 v2.1.1 章节
- [ ] 跑 `node --test tests/*.test.mjs`：预期 20/20 全绿
- [ ] `bash pack.sh` 重打 `OPC-X-Reply-Extension.zip`
- [ ] `git add` + `git commit` + `git push`（走 `/ship`）
- [ ] **Chrome 实测（用户跑）**：装载新 zip → options 页 hero/footer 署名核对 → 草稿窗副标题核对 → 8 渠道任选 1-2 个回归确认无误伤

## 摘要

v2.1.0 commit (`0fba933`) 在 push 之后又陆续手动调了 4 个文件（作者署名升级、provider 文案、Base URL 位置、空 `<a>` 残留）。本次 v2.1.1 把这些散落改动收拢成一个补丁版本：三处作者署名统一为「强子手记 @iBigQiang & Akiii @Guomin184935」、`迭代需求1.md` 末尾残留清除、`provider` 加「兼容」前缀与 Base URL 上移这两条 UI 调整原样保留、`CLAUDE.md`「作者署名（固定）」段重写避免未来回退、版本号升到 v2.1.1。不动任何被测代码，预期测试仍 20/20。

## 复盘

待 push 完成后填写。
