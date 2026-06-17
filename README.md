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

## 移动端使用步骤

**方式一 · 同一 WiFi**：手机与电脑连同一 WiFi，手机浏览器打开前端启动时打印的 **`Network`** 地址（形如 `http://192.168.x.x:5173`，不是 `localhost`）。

**方式二 · 手机热点**（WiFi 连不上、或在校园网/公共 WiFi 时用，更可靠）：
1. 手机开启个人热点。
2. **电脑连这个热点**（注意是电脑连手机，不是手机连电脑）。
3. 重新看前端终端打印的 `Network` 地址（连热点后 IP 会变，通常是 `172.20.10.x`），手机浏览器打开它。

> 热点是你自己的网络，没有 AP 隔离，必通；代价是走一点手机流量（每次只传一张压缩到 1.8MB 内的图）。

## 常见问题

### 启动相关
- **后端报 key 错误** → `server/.env` 没建或没填真实 key。
- **端口 3000 被占用（EADDRINUSE）** → 旧进程没关干净，用 `netstat -ano | findstr :3000` 找到 PID，`taskkill /PID <pid> /F` 杀掉。
- **后端单测不过** → 可选步骤，不影响使用；如需验证：`cd server && npm test`，期望 6 个用例全过。

### 扫描相关
- **"AI 走神了"** → 可能原因：
  - 图片太模糊或无法识别物品
  - API key 余额不足或失效
  - 网络问题导致请求超时
  - 模型返回格式不符合预期（查看后端终端日志 `[vision] extractJson failed`）
- **扫描超时（60秒）** → 图片过大或网络慢，前端会自动压缩到 1.8MB，但首次上传可能较慢；或检查 `QWEN_BASE_URL` 是否正确。
- **识别结果不准确** → Qwen-VL 对中文物品识别较好，但复杂场景或小众物品可能偏差；可尝试换个角度重拍，或调整 `server/src/prompt.ts` 中的 prompt。

### 移动端相关
- **手机连不上** → 
  - ① Windows 防火墙拦截 5173 端口，临时关闭防火墙或添加入站规则
  - ② 电脑代理软件（VPN/Clash）劫持局域网流量，临时关掉
  - ③ 校园网/公共 WiFi 有 AP 隔离，改用手机热点让电脑连
- **手机拍照后卡住** → iOS 的 HEIC 格式已做兼容，但部分安卓机型可能有问题；尝试从相册选图而非直接拍照。

### 其他
- **前端白屏** → 检查浏览器控制台报错，多为前端 `/api/scan` 请求失败或后端未启动。
- **Windows 换行符警告（LF/CRLF）** → Git 自动转换提示，不影响运行，可忽略。
