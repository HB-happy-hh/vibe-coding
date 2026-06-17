# 万物皆可扫 PoC

拍一张物品照片 → AI 视觉模型识别物品、写第一人称日记、推荐对应服务的移动端 H5 demo。
后端（Express）藏密钥并调用阿里云百炼 Qwen-VL，前端（Vite）负责拍照、压缩、展示。

## 环境要求

- **Node.js 20+**（含 npm）。先 `node -v` 检查；没装或版本低于 20：
  - Windows / macOS：去 https://nodejs.org 下载 LTS 安装包，一路下一步即可。
  - 或用版本管理器：Windows 用 [nvm-windows](https://github.com/coreybutler/nvm-windows)，macOS/Linux 用 [nvm](https://github.com/nvm-sh/nvm)，装好后 `nvm install 20 && nvm use 20`。
- **阿里云百炼 API Key**：
  - 登录 https://dashscope.console.aliyun.com → 开通灵积模型服务 → API-KEY 管理 → 创建新的 API-KEY
  - 形如 `sk-xxx`，新用户赠送 2000 万 Token 永久有效

## 配置密钥

后端从 `server/.env` 读密钥。复制示例文件后填入真实值：

```bash
cd server
cp .env.example .env        # Windows PowerShell： Copy-Item .env.example .env
```

编辑 `server/.env`：

```dotenv
QWEN_API_KEY=填你的真实key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-vl-plus
PORT=3000
```

## 启动（两个终端）

```bash
# 终端 1 —— 后端
cd server && npm install && npm run dev      # 出现 [scan] listening on :3000 即成功

# 终端 2 —— 前端
cd web && npm install && npm run dev         # 出现 Local / Network 地址即成功
```

浏览器打开 `http://localhost:5173`，看到拍照界面即可开始使用。

## 部署到 Vercel

本仓库同时支持本地开发和 Vercel 部署：
- 本地开发入口：`server/src/index.ts`（Express，`npm run dev`）
- Vercel 函数入口：`api/scan.ts`（自包含，零跨目录导入）

部署步骤：

1. 在 Vercel 导入这个 Git 仓库
2. Framework 选 **Other**，Build Command 保持 `npm run build:web`，Output Directory 保持 `web/dist`
3. Settings → Environment Variables 添加（全部选 Production）：
   - `QWEN_API_KEY` — 阿里云百炼 API Key
   - `QWEN_BASE_URL` — `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - `QWEN_MODEL` — `qwen-vl-plus`
4. Deploy，完成后去 Settings → Deployment Protection → 关闭 Vercel Authentication（否则手机访问会要求登录）
5. 生产域名在 Settings → Domains 查看，格式 `项目名.vercel.app`，不会变

> 说明：`api/scan.ts` 是自包含的 Serverless 函数，所有业务逻辑内联在单文件中，不依赖 `server/src/` 下的文件。本地开发照常用 Express + Vite proxy，两者互不干扰。

## 移动端使用步骤

**方式一 · 同一 WiFi**：手机与电脑连同一 WiFi，手机浏览器打开前端启动时打印的 **`Network`** 地址（形如 `http://192.168.x.x:5173`，不是 `localhost`）。

**方式二 · 手机热点**（WiFi 连不上、或在校园网/公共 WiFi 时用，更可靠）：
1. 手机开启个人热点。
2. **电脑连这个热点**（注意是电脑连手机，不是手机连电脑）。
3. 重新看前端终端打印的 `Network` 地址（连热点后 IP 会变，通常是 `172.20.10.x`），手机浏览器打开它。

> 热点是你自己的网络，没有 AP 隔离，必通；代价是走一点手机流量（每次只传一张压缩到 1.8MB 内的图）。

## 常见问题

### 启动相关
- **后端报 key 错误** → `server/.env` base_url多写了/v1或没填真实 key。
- **端口 3000 被占用（EADDRINUSE）** → 旧进程没关干净，用 `netstat -ano | findstr :3000` 找到 PID，`taskkill /PID <pid> /F` 杀掉。
- **后端单测不过** → 可选步骤，不影响使用；如需验证：`cd server && npm test`，期望 8 个用例全过。

### 扫描相关
- **"AI 走神了"** → 可能原因：
  - 图片太模糊或无法识别物品
  - API key 余额不足或失效
  - 网络问题导致请求超时
  - 模型返回格式不符合预期（查看后端终端日志 `[vision] extractJson failed`）
- **扫描超时（60秒）** → 图片过大或网络慢，前端会自动压缩到 1.8MB，但首次上传可能较慢；或检查 `QWEN_BASE_URL` 是否正确。
- **识别结果不准确** → 模型对比经验：
1. Qwen-3.6-plus 会把马克杯识别成花盆，不可用
2. Qwen-VL 识别较准确，但仍有错误样例（如戴帽子的萨摩耶被识别成毛绒连衫帽）
3. 智谱 GLM-5V-turbo 识别较慢，单次经常超过 60 秒
4. Claude 系列经中转站调用，效果最好但不稳定，时常掉线
5. 综合考虑准确率与稳定性，最终采用 Qwen-VL

### 移动端相关
- **手机连不上** → 
  - ① Windows 防火墙拦截 5173 端口，临时关闭防火墙
  - ② 电脑代理软件（VPN/Clash）劫持局域网流量，临时关掉
  - ③ 校园网/公共 WiFi 有 AP 隔离，改用手机热点让电脑连
- **手机拍照后卡住** → iOS 的 HEIC 格式已做兼容，但部分安卓机型可能有问题；尝试从相册选图而非直接拍照。
