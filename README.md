# dsh-usage-cute

可爱风的 DeepSeek Token 用量 & 账户余额面板，为 DeepSeek Harness Web GUI（`dsh web`）设计。

A cute DeepSeek token-usage & account-balance panel for the DeepSeek Harness Web GUI.

## ✨ 功能

- 💳 **多账号余额**：DeepSeek（`/user/balance`）与硅基流动 SiliconFlow（`/user/info`）多账号切换，展示总余额、充值余额、赠送余额与可用状态
- 🔑 **账号切换**：面板下拉框切换 DeepSeek 多 key / SiliconFlow 账号，选择自动记忆（localStorage）
- 📊 **Token 用量**：聚合所有会话事件，按天/按模型统计今日、本月、累计用量与缓存命中率
- 📈 **14 天迷你柱状图**：粉色渐变柱，悬停变蓝
- 🐣 **可爱设计**：improved-1 吉祥物、粉蓝渐变色卡、大圆角、弹入动画
- 🖱️ **可拖动面板**：按住头部拖动，位置自动记忆（localStorage）
- 🔒 **本机安全**：端点仅限回环 GET；API Key 只在服务端解析，不发往浏览器
- 🔄 **自动刷新**：每 5 分钟自动更新

> 账号来源：`~/.dsh/.credentials.yaml` 中的**所有 key**，按 key 名自动推断余额接口——`DEEPSEEK_API_KEY*` → DeepSeek（`/user/balance`）；含 `SILICONFLOW` 或 `OPENAI_API_KEY` → 硅基流动（`/user/info`）；其他 key 会列出但显示「无余额接口」。官方 OpenAI 等无公开余额接口的 provider 不显示余额。

## 📦 安装

需要 DeepSeek Harness `web` profile（`@deepseek-ai/dsh >= 0.1.0-rc.6`）与 `pnpm`。

```bash
dsh plugin --profile web add "file:/绝对/路径/dsh-usage-cute"
```

然后重启 `dsh web`（开关式启动器停一次再开一次），浏览器硬刷新（Cmd+Shift+R）。侧边栏底部会出现带可爱 logo 的「用量 & 余额」按钮。

### 卸载

```bash
dsh plugin --profile web remove dsh-usage-cute
```

## 🧩 结构

```
dsh-usage-cute/
├── package.json          # 声明 dsh.bundle.patch + client.platform=web
├── cordis.patch.yml      # 补丁层：insert 插件入口
├── assets/logo.png       # 吉祥物（improved-1）
└── lib/
    ├── index.js          # 服务端：余额/用量/logo 三个回环路由
    ├── usage.js          # 纯函数：按天/按模型聚合 token
    └── client.js         # 浏览器端：侧边栏按钮 + 可拖动浮层面板
```

## 📝 开发说明

- 服务端注入 `webServer / credentials / settings / sessions / sessionPersistence` 服务
- 账号列表端点：`GET /api/usage-cute/accounts`
- 余额端点：`GET /api/usage-cute/balance?account=<provider>:<ref>`
- 用量端点：`GET /api/usage-cute/usage`
- Logo 端点：`GET /api/usage-cute/logo.png`
- 客户端为手写 `__ModuleLoader__` bundle，无构建步骤

## ⚠️ 注意

- 插件是 `file:` 软链安装，修改后**重启 dsh web** 即可生效
- 重启会断开当前运行的 dsh 会话

## 📄 License

MIT
