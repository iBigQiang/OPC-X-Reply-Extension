# OPC-X-Reply-Extension / X 推文互动回复器 v2.0

OPC-X-Reply-Extension 是一个用于 X / Twitter 的 AI 推文互动回复 Chrome 扩展。

本项目基于 [Akiii-v-1.9](https://github.com/futakocui008/Akiii-v-1.9) 优化迭代而来，保留了原项目面向 X / Twitter KOL、Crypto / Web3 内容创作者、社区运营和增长人员的核心定位：在推文旁边一键生成自然、有观点、无 AI 味的中英文评论，并且只辅助生成和填入，不自动发送。

## 来源与致谢

- 原项目：[Akiii-v-1.9](https://github.com/futakocui008/Akiii-v-1.9)
- 原作者：Akiii / [@Guomin184935](https://x.com/Guomin184935)
- 本项目在上游基础上继续优化，当前可见署名保留为：`强子手记 @iBigQiang & Akiii @Guomin184935`

## 项目定位

插件的目标不是自动灌水，而是提升日常互动效率：

- 快速理解当前推文内容
- 生成更像真人表达的短评论
- 避免常见 AI 味、套话和营销腔
- 支持中文、英文和中英混合推文
- 让用户先编辑草稿，再手动决定是否填入 X

生成内容会先进入可编辑草稿窗，用户可以修改、删减、润色，确认满意后再点击 `填入 X`。插件不会自动发布任何回复。

## 核心能力

- 时间线推文旁显示 `AI回`
- 打开回复框后显示 `AI填入`
- 自动识别推文语言，中文推文生成中文回复，英文推文生成英文回复
- 内置去 AI 味提示词，减少空话、套话、官话和营销味表达
- 支持自定义禁用词
- 支持额外提示词作为风格参考
- 支持默认项目方 @账号，合适时自然带入项目方 handle
- 支持 OpenAI Responses API
- 支持兼容 Chat Completions 的接口
- 支持 API2D / 中转接口
- `fk` 开头 Key 自动识别为 API2D / 中转 Key
- 配置和 API Key 仅保存在浏览器本地扩展存储中
- 保留二次元初音风底图和玻璃拟态 UI

## OPC-X-Reply-Extension 特别优化

相比上游 Akiii-v-1.9，本仓库做了更偏实用和稳定性的优化：

### 1. 一次生成 3 条候选

点击 `AI回` 或 `AI填入` 后，不再只生成单条回复，而是一次生成 3 条候选。

用户可以在 3 条候选里选择更合适的一条，减少反复点击生成的成本。

### 2. 三栏候选草稿窗

生成后会弹出可编辑草稿窗，每条候选都有独立文本框。

每条候选都支持：

- 手动编辑
- 单独复制
- 单独填入 X

### 3. 更严格的输出数量和格式控制

额外提示词只作为角色、语气和边界参考。

即使用户在额外提示词里写了其他数量、标题、分组或输出格式，插件仍会优先遵守本次任务要求：生成固定数量候选，并要求模型输出可解析的 JSON 数组。

### 4. 候选解析、清洗、去重和重试

后台会解析模型返回的 JSON 数组、对象、Markdown 列表和编号列表，并对候选做清洗、去重、禁用词过滤和乱码修复。

如果第一次没有拿到足够的 3 条有效候选，会继续重试补足，而不是直接把不合格内容展示给用户。

### 5. 接口错误提示更清楚

当接口返回 HTML 或非 JSON 内容时，插件会直接提示 Base URL 或接口路径可能配置错误。

这避免了把接口错误静默包装成固定兜底回复，方便用户快速定位 OpenAI / API2D / 中转接口配置问题。

### 6. API Key 识别更适合新手

如果检测到 `fk` 开头 Key，会自动按 API2D / 中转接口处理，减少误选 OpenAI 官方接口导致的报错。

设置页也会提示官方 OpenAI Key 和 API2D / 中转 Key 的差异。

### 7. 插件图标打开独立设置页

点击浏览器插件图标会打开独立设置页，不再使用容易自动关闭的 popup 设置框。

填写 API Key、Base URL、禁用词和额外提示词时更稳定。

### 8. 填入 X 的选择更稳

插件会优先识别当前可见的 X 回复弹窗和编辑框，减少填错位置、找不到输入框或重复插入的问题。

填入失败时会尽量复制到剪贴板，用户可以手动粘贴，避免生成结果丢失。

### 9. 加入基础自动化测试

仓库包含 `tests/` 测试文件，覆盖后台生成逻辑、内容脚本、样式约束和 manifest 行为。

当前可用命令：

```text
node --test tests\*.mjs
```

## 安装方式

1. 下载或解压本项目代码。
2. 打开 Chrome 浏览器。
3. 进入：

```text
chrome://extensions/
```

4. 打开右上角「开发者模式」。
5. 点击「加载已解压的扩展程序」。
6. 选择本项目文件夹。
7. 点击插件图标，填写 API Key、接口类型和 Base URL。
8. 保存设置后刷新 X / Twitter 页面使用。

## 使用方式

### 1. 设置 API Key

点击浏览器右上角插件图标，进入设置页。

支持：

```text
OpenAI 官方 Key：sk- / sk-proj- 开头
API2D / 中转 Key：fk 开头
```

如果使用 API2D 或兼容 Chat Completions 的中转接口，请确认 Base URL 填写的是接口地址，而不是网站首页或控制台页面。

### 2. 在 X 页面生成回复

打开 X / Twitter 后，推文旁边会出现：

```text
AI回
```

点击后，插件会读取当前推文内容并生成 3 条回复候选。

### 3. 在回复框内生成

打开 X 回复框后，工具栏旁边会出现：

```text
AI填入
```

点击后同样会生成 3 条可编辑候选。

### 4. 编辑并填入

生成结果会先进入草稿窗。

你可以自由修改任意候选，确认满意后点击对应的：

```text
填入 X
```

插件只填入回复内容，不会自动发送。

## 配置说明

| 配置项 | 说明 |
| --- | --- |
| 接口类型 | 支持 OpenAI Responses API、兼容 Chat Completions、API2D / Chat Completions |
| API Key | OpenAI 官方 Key 通常以 `sk-` / `sk-proj-` 开头；API2D / 中转 Key 通常以 `fk` 开头 |
| 模型 | 默认使用 `gpt-4.1-mini`，可在设置页修改 |
| 默认语言 | 可设置自动 / 中文优先或英文优先 |
| Base URL | OpenAI / 兼容接口请填写真实 API Base，例如以 `/v1` 结尾的地址 |
| API2D Base URL | API2D 默认地址为 `https://oa.api2d.net/v1` |
| 中文上限 | 控制中文回复长度 |
| 英文词数 | 控制英文回复词数 |
| 默认项目方 @账号 | 可填写项目方 handle，插件会在合适时自然使用 |
| 禁用词 | 逗号分隔，插件会尽量避开这些词 |
| 额外提示词 | 只作为风格、人设和边界参考，不覆盖 3 条候选和 JSON 输出格式 |
| 调试日志 | 开启后方便排查接口和页面填入问题 |

## 文件结构

```text
OPC-X-Reply-Extension/
├── manifest.json
├── background.js
├── content.js
├── content.css
├── options.html
├── options.js
├── README.md
├── 禁用词.txt
├── 额外提示词.txt
├── OPC-X-Reply-Extension.zip
├── img/
│   ├── i_16.png
│   ├── i_32.png
│   ├── i_48.png
│   ├── i_128.png
│   ├── i_256.png
│   ├── options_bg.png
│   └── Qiangge.png
└── tests/
    ├── background.test.mjs
    ├── content-css.test.mjs
    ├── content-js.test.mjs
    └── manifest.test.mjs
```

## 注意事项

1. 插件不会自动发布内容。
2. 所有生成内容建议人工检查后再发布。
3. 请勿把自己的 API Key 写入代码或上传到 GitHub。
4. API Key 保存在浏览器本地扩展存储中；生成回复时，推文内容会发送到你配置的模型服务。
5. 如果 X 页面结构更新，按钮位置和填入逻辑可能需要后续适配。
6. 如果接口返回 HTML / 非 JSON，请优先检查 Base URL、接口路径和接口类型。

## License

上游 Akiii-v-1.9 README 标注为 MIT License。本仓库保留上游来源和作者信息，正式分发时建议同步补充独立 `LICENSE` 文件。

## 来源出处

本仓库项目 OPC-X-Reply-Extension 是基于 [Akiii-v-1.9](https://github.com/futakocui008/Akiii-v-1.9) 优化迭代而来。

原项目作者信息请参考上游仓库 README：

- GitHub：[futakocui008/Akiii-v-1.9](https://github.com/futakocui008/Akiii-v-1.9)
