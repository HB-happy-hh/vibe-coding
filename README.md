# 万物皆可扫 PoC

拍一张物品照片 → Claude 视觉模型一次调用 → 输出「物品识别 + 状态 + 第一人称日记 + 智能服务推荐」的移动端 H5 demo。

架构是三段式：H5 前端（Vite）压缩图片后 base64 上传 → Node/Express 代理（藏密钥、把模型回复整成稳定 JSON）→ Claude 视觉调用。

---

## 1. 前置依赖

跑起来前，机器上需要装好：

| 依赖 | 版本要求 | 怎么确认 / 获取 |
| --- | --- | --- |
| **Node.js** | **20 或更高**（含自带的 npm） | 终端跑 `node -v`，没有就去 https://nodejs.org 装 LTS 版 |
| **一个 Anthropic API Key** | 必需 | 官方 key（`sk-ant-...`，从 https://console.anthropic.com 获取）或任意兼容的中转站 key |
| Git | 可选，仅拉代码用 | `git --version` |

> 不需要全局装任何东西，所有依赖都在各自目录 `npm install` 时本地安装。
> 项目分两个独立的 npm 工程：`server/`（后端）和 `web/`（前端），各自有自己的依赖。

---

## 2. 配置环境变量（关键，漏了后端起不来）

后端的密钥从 `server/.env` 读取。仓库里只有示例文件 `server/.env.example`，**真实的 `.env` 不会进 git**，需要自己建：

```bash
cd server
cp .env.example .env      # Windows PowerShell 用： Copy-Item .env.example .env
```

然后编辑 `server/.env`，三个变量含义如下：

```dotenv
# 必填。你的 Anthropic key 或中转站 key
ANTHROPIC_API_KEY=sk-ant-填你的真实key

# 选填。用官方 key 时留空即可；用中转站时填中转站给的 baseURL（如 https://xxx.com/v1）
ANTHROPIC_BASE_URL=

# 选填。后端端口，默认 3000，一般不用改
PORT=3000
```

⚠️ 用中转站的 key 时，`ANTHROPIC_BASE_URL` **必须填**，否则会去连官方地址、密钥对不上而失败。

---

## 3. 启动项目（需要两个终端，分别跑后端和前端）

### 终端 1 —— 后端

```bash
cd server
npm install        # 首次运行必做，安装依赖
npm run dev
```

看到 `[scan] listening on :3000` 就成功了。

验证后端活着（另开终端或浏览器访问）：

```bash
curl http://localhost:3000/health        # 期望返回 {"ok":true}
```

### 终端 2 —— 前端

```bash
cd web
npm install        # 首次运行必做
npm run dev
```

Vite 会打印两行地址：

```
➜  Local:   http://localhost:5173/        ← 本机浏览器用这个
➜  Network: http://192.168.x.x:5173/      ← 手机/局域网设备用这个
```

电脑上用浏览器开 `http://localhost:5173` 即可看到拍照界面。

---

## 4. 用手机访问（同一 WiFi）

想在手机上真机体验（真·调起相机拍照）：

1. **手机和电脑连同一个 WiFi。**
2. 手机浏览器打开第 3 步里 Vite 打印的 **`Network`** 地址，例如 `http://192.168.x.x:5173`。
3. 点圆形快门 → 调起相机拍照 → 看扫描动效 → 进结果屏。

> 找不到自己电脑 IP？终端跑 `ipconfig`（Windows）/ `ifconfig`（Mac/Linux），看无线网卡的 IPv4 地址，与 Vite 打印的 `Network` 应一致。

---

## 5. 跑测试（可选）

后端带单元测试：

```bash
cd server
npm test           # 期望 6 个用例全过（claude 3 + scan 3）
```

---

## 6. 常见问题排查

| 现象 | 原因 / 解法 |
| --- | --- |
| 后端启动报 `ANTHROPIC_API_KEY` 相关错误 | `server/.env` 没建或 key 没填，回到第 2 步 |
| 出结果时报 "AI 走神了" / 一直失败 | 多为中转站 key 没配 `ANTHROPIC_BASE_URL`，或 key 失效 |
| 手机打不开 `Network` 地址 | ①Windows 防火墙拦了 5173 端口；②电脑开着代理软件（VPN/Clash 等）劫持了流量，临时关掉再试 |
| 手机和电脑同 WiFi 仍连不上 | **校园网/公司网/公共 WiFi 常开 AP 隔离**，设备间互访被禁。改用「手机开热点 → 电脑连热点」，再用新的 `Network` 地址 |
| 手机拍照后没反应 | 确认前端是最新代码（拍照流程已修过 iOS 兼容问题） |
| 端口 3000 / 5173 被占用 | 后端改 `server/.env` 的 `PORT`；前端在 `web/vite.config.js` 改 `server.port`（注意两边要对应） |

### Windows 防火墙放行 5173（手机连不上时）

管理员 PowerShell：

```powershell
New-NetFirewallRule -DisplayName "vite-5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
# 演示完想撤销： Remove-NetFirewallRule -DisplayName "vite-5173"
```

---

## 项目结构

```
.
├── server/                 # 后端：Express 代理 + Claude 调用
│   ├── src/
│   │   ├── index.ts        # Express 启动 + 路由
│   │   ├── scan.ts         # /api/scan 处理器（校验、错误码）
│   │   ├── claude.ts       # 调 Claude + JSON 抽取容错
│   │   └── prompt.ts       # Prompt 模板
│   ├── tests/              # Vitest 单测
│   └── .env.example        # 环境变量示例（复制成 .env 填真值）
└── web/                    # 前端：Vite + vanilla H5
    ├── index.html
    └── src/
        ├── main.js         # 状态机、界面联动
        ├── api.js          # 调 /api/scan
        ├── compress.js     # 图片压缩到 ≤1.8MB
        └── styles.css
```

