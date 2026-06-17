# 万物皆可扫 PoC

拍一张物品照片 → Claude 视觉模型识别物品、写第一人称日记、推荐对应服务的移动端 H5 demo。
后端（Express）藏密钥并调用 Claude，前端（Vite）负责拍照、压缩、展示。

## 环境要求

- Node.js **20+**（含 npm）。`node -v` 确认。
- 一个 Anthropic API Key（官方 `sk-ant-...` 或中转站 key）。

## 配置密钥

后端从 `server/.env` 读密钥。复制示例文件后填入真实值：

```bash
cd server
cp .env.example .env        # Windows PowerShell： Copy-Item .env.example .env
```

编辑 `server/.env`：

```dotenv
ANTHROPIC_API_KEY=填你的真实key
ANTHROPIC_BASE_URL=         # 官方key留空；中转站key必须填中转地址，如 https://xxx.com/v1
PORT=3000
```

## 启动（两个终端）

```bash
# 终端 1 —— 后端
cd server && npm install && npm run dev      # 出现 [scan] listening on :3000 即成功

# 终端 2 —— 前端
cd web && npm install && npm run dev         # 出现 Local / Network 地址即成功
```

## 验证能否跑起来

1. **后端通**：浏览器或 curl 访问 `http://localhost:3000/health`，返回 `{"ok":true}`。
2. **前端通**：浏览器开 `http://localhost:5173`，看到拍照界面。
3. **整条链路通**：界面上传一张图，能出「物品名 + 日记 + 服务卡」即全通。
4. （可选）后端单测：`cd server && npm test`，期望 6 个用例全过。

## 手机访问（同一 WiFi 真机体验）

手机与电脑连同一 WiFi，手机浏览器打开前端启动时打印的 **`Network`** 地址（形如 `http://192.168.x.x:5173`，不是 `localhost`）。

## 跑不起来时

- 后端报 key 错误 → `server/.env` 没建或没填。
- 出结果报 "AI 走神了" → 多为中转站 key 没配 `ANTHROPIC_BASE_URL`。
- 手机连不上 → ①Windows 防火墙拦 5173；②电脑代理软件（VPN/Clash）劫持，临时关掉；③校园网/公共 WiFi 有 AP 隔离，改用手机热点让电脑连。
