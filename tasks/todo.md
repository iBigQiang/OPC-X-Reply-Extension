# v2.1.4 — hero 区作者超链接去样式 + 背景图替换收尾 + section-title 图标 lucide 化 + 修复 API Key 泄露事故

## 任务清单

- [x] `options.html` 加 `.author a` 系列 CSS 让 hero 区作者那一行的两个 `<a>` 链接显示得跟普通文字一致（无下划线、继承父色，hover 微淡）
- [x] **不动 footer**（用户明确范围限于 hero 区作者那一行）
- [x] 接受用户已做的视觉调整：背景图 `img/akiii_bg.jpg` → `img/options_bg.png`（options.html + content.css）、暗化层 alpha 调淡
- [x] `manifest.json` 升 v2.1.4 + 用户改的 `web_accessible_resources`（已替换图片名）一并纳入
- [x] 替换 3 个 section-title 占位字符为 lucide inline SVG：`✎`/`⌁`/`Aa` → `square-pen`/`plug`/`sliders-horizontal`；新增 `.section-title .icon svg` 14×14 尺寸规则
- [x] **修复 API Key 泄露事故**
  - [x] 脱敏 `docs/开发及迭代方案调研报告/迭代需求1.md:14` 里的真实 DeepSeek Key
  - [x] `.gitignore` 加 `docs/开发及迭代方案调研报告/` + 一组防御性密钥规则
  - [x] `git rm -r --cached docs/开发及迭代方案调研报告/` 让 git 不再追踪
  - [ ] `git filter-repo --path "docs/开发及迭代方案调研报告/" --invert-paths` 重写所有历史 commit
  - [ ] `git push --force-with-lease origin main` 覆盖远端
- [x] `docs/DEVLOG.md` 追加 v2.1.4 章节（含图标 + 安全事故修复）
- [ ] 跑 `node --test tests/*.test.mjs`：预期 41/41
- [ ] `bash pack.sh` 重打 `OPC-X-Reply-Extension.zip`
- [ ] `git add` + `git commit`（v2.1.4 + 图标 + .gitignore + git rm --cached + DEVLOG + todo + zip）
- [ ] **Chrome 实测（用户跑）**：装载新 zip → hero 区作者那一行的「强子手记」「Akiii」无下划线无蓝色，hover 微淡；新背景图正常显示；3 个 section-title 左侧 lucide 图标清晰可见
- [ ] **用户手动**：到 https://platform.deepseek.com 撤销已泄露的 Key（具体值在 GitGuardian 邮件中）

## 摘要

v2.1.1 给作者署名加了 X 主页超链接，但浏览器默认蓝+下划线在玻璃拟态背景下太突兀。本次给 `.author a` 加 `color: inherit; text-decoration: none;`，hover 用 `opacity: .85` 给一点反馈，`href` 保留可点。范围严格限 hero 区作者那一行（用户明确要求），footer 不动。同时收尾用户已经在做的背景图替换（akiii_bg.jpg → options_bg.png）+ 暗化层调淡。

另外把设置页 3 个 section-title 左侧的 Unicode 占位字符（`✎` / `⌁` / `Aa`）换成 lucide 风格的 inline SVG（`square-pen` / `plug` / `sliders-horizontal`）：`⌁` 在多数字体里 tofu，`Aa` 语义跟「参数面板」对不上，换成线条图标后既清晰又能用 currentColor 继承青色高亮。

**还包含一个严重安全事故修复**：GitGuardian 检出 `docs/开发及迭代方案调研报告/迭代需求1.md:14` 在 v2.1.0 / v2.1.3 提交时硬编码了真实 DeepSeek API Key。本次脱敏当前文件 + `.gitignore` 永久排除该目录 + `git rm --cached` 让 git 停止追踪 + `git filter-repo` 重写所有历史 commit + `force push` 覆盖远端。用户必须额外到 DeepSeek 平台撤销该 Key（爬虫缓存可能已抓取）。

## 复盘

待 push 完成后填写。
