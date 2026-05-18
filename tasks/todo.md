# 文档底座补齐 — 2025-05-18

## 任务清单

- [x] 完整阅读 `manifest.json` / `background.js` / `content.js` / `content.css` / `options.html` / `options.js` / `tests/*` / `README.md`
- [x] 起草 CLAUDE.md / DEVLOG.md / 方案文档大纲
- [x] 写 `docs/开发及迭代方案调研报告/2025-05-18-文档底座补齐.md`
- [x] 写 `CLAUDE.md`（项目根）
- [x] 写 `docs/DEVLOG.md`
- [x] 写 `tasks/todo.md`（即本文件）
- [x] 跑 `node --test tests/*.test.mjs` 确认未误伤现有测试（结果：6/6 全过）
- [x] 复盘填写
- [x] 执行 `/ship` 收尾
- [x] 接入 git 仓库（`git init` + 远端 `https://github.com/iBigQiang/OPC-X-Reply-Extension.git`）
- [x] `git pull --rebase`，保留远端 5 个历史 commit，README 冲突按远端版本解决
- [x] 写 `pack.sh` 并把"push 前必跑 `bash pack.sh`"写进 `CLAUDE.md` 的「/ship 收尾流程（本项目专用）」
- [x] 跑 `bash pack.sh` 生成新 `OPC-X-Reply-Extension.zip` 覆盖远端老 zip
- [x] `git commit` 把所有 v2.0.1/v2.0.2 变更 + 新 zip 一起入库，`git push` 到 `origin/main`

## 摘要

本次只做文档底座，不动任何代码、测试、manifest。目的是让后续迭代规则跑得通：

1. 项目专属 `CLAUDE.md` 让任何 Claude 会话进入项目能立刻不犯错（不要硬替换 React DOM、不要把 HTML 响应当兜底回复、不要加 popup 等）
2. `docs/DEVLOG.md` 提供"最新版本在最前"的开发日志骨架，回填 v2.0.0
3. `docs/开发及迭代方案调研报告/2025-05-18-文档底座补齐.md` 沉淀本次方案
4. 本 todo 文件提供任务勾选 + 复盘位置

## 复盘

- **最有价值的章节**：CLAUDE.md 的「关键运行机制（防退化清单）」和「绝对不要」两节。把 v2.0 用真实 bug 换来的经验（React/Draft 不能硬替换、HTML 响应要抛配置错误、`fk` Key 切 API2D）固化成不变约束。任何新 Claude 会话只读这两段就能绕开主要雷区。
- **可以精简的章节**：CLAUDE.md 的「DEFAULT_SETTINGS」表 12 字段稍长，但每条都对应一个真实配置项，删谁都会让某次配置出错时找不到出处，暂保留。
- **v1.x 信息考古**：暂不补。v1.x 设计已被 v2.0 完全替代（弹出式 popup → 独立 options 页、1 条 → 3 条候选、selectNodeContents 硬替换 → paste 事件），考古 commit 也没法跑回去验证，投入产出比低。
- **关键修正**：写文档时把测试命令写成了 `node --test tests/`，实跑发现 Node 22 不展开目录，必须 `node --test tests/*.test.mjs`。所有 4 个文档已统一更正。这条经验本身值得记到 lessons：**写命令时必须立刻在 shell 里跑一遍，不能依赖印象**。
- **下次迭代的明确动作**：
  - 执行 `/btw` 扫 3-5 个改进点（按全局规则要求）
  - 候选方向：项目根的两个「额外提示词*.txt」要不要挪到 `docs/prompts/` 或 `prompts/`；`temperature: 0.85` 要不要暴露成设置；`tokenLimitForCount` 写死可能截断长输出；options 里 provider 选 `chat` 和 `api2d` 实际走同一条路径，要不要合并；可以补一份 ARCHITECTURE.md 把消息时序图画出来
  - 等用户确认方向后再开下一个迭代
