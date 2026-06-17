# 万物皆可扫 PoC 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 跑通"拍照 → Claude 视觉一次调用 → 物品第一人称日记 + 智能服务推荐"的移动端 H5 核心闭环。

**Architecture:** 三段式——H5 前端（vanilla + Vite）压缩图片 base64 上传 → Node/TypeScript 代理（Express + tsx）藏密钥并把 Claude 回复整成稳定 JSON → Claude 视觉一次调用同时产出物品识别、状态、≤100 字日记、四类服务推荐之一。

**Tech Stack:** TypeScript + Node 20、Express、`@anthropic-ai/sdk`、Vitest（后端单测）、Vite（前端静态托管）、vanilla HTML/CSS/JS。

---

## 仓库结构

```
.
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts           # Express 启动 + 路由挂载
│   │   ├── scan.ts            # /api/scan 处理器（含校验、错误码）
│   │   ├── claude.ts          # 调 Claude + JSON 抽取容错
│   │   └── prompt.ts          # Prompt 模板与 schema 描述
│   └── tests/
│       ├── claude.test.ts     # JSON 抽取容错单测
│       └── scan.test.ts       # 端点 happy path 单测
├── web/
│   ├── package.json
│   ├── index.html
│   ├── src/
│   │   ├── main.js            # 入口、状态机
│   │   ├── api.js             # fetch /api/scan 封装
│   │   ├── compress.js        # 图片压缩到 ≤2MB
│   │   └── styles.css
│   └── vite.config.js
├── .gitignore
└── docs/superpowers/...
```

---

## Task 1：仓库脚手架

**Files:**
- Create: `.gitignore`
- Create: `README.md`（最小，仅启动指引）

- [ ] **Step 1：写 `.gitignore`**

```gitignore
node_modules/
.superpowers/
dist/
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 2：写最小 `README.md`**

```markdown
# 万物皆可扫 PoC

```bash
# 后端
cd server && npm install && npm run dev   # http://localhost:3000

# 前端（另开终端）
cd web && npm install && npm run dev      # http://localhost:5173
```

环境变量：`server/.env` 中设 `ANTHROPIC_API_KEY=sk-...`。
```

- [ ] **Step 3：提交**

```bash
git add .gitignore README.md
git commit -m "chore: bootstrap repo with gitignore and readme"
```

---

## Task 2：后端项目初始化

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`

- [ ] **Step 1：写 `server/package.json`**

```json
{
  "name": "ar-scan-server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.7.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2：写 `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3：写 `server/.env.example`**

```
ANTHROPIC_API_KEY=sk-replace-me
PORT=3000
```

- [ ] **Step 4：安装依赖并验证**

Run: `cd server && npm install`
Expected: 安装无报错，生成 `node_modules` 与 `package-lock.json`。

- [ ] **Step 5：提交**

```bash
git add server/package.json server/tsconfig.json server/.env.example server/package-lock.json
git commit -m "chore(server): init node ts project"
```

---

## Task 3：Prompt 模板

**Files:**
- Create: `server/src/prompt.ts`

- [ ] **Step 1：写 `server/src/prompt.ts`**

```ts
export const SYSTEM_PROMPT = `你是"万物皆可扫"应用里的物品观察者。看到一张物品照片后，你必须严格只输出一个 JSON 对象，不要 Markdown 代码块、不要前后解释。
JSON 字段（全部必填）：
{
  "object": { "name": string, "state": string },
  "diary":  string,            // 以该物品的第一人称写的日记，中文 ≤ 100 字，自然口吻
  "recommend": {
    "type":    "ecommerce" | "local" | "resale" | "tips",
    "title":   string,
    "reason":  string,
    "keyword": string,         // tips 类型可为空字符串
    "cta":     string
  }
}

服务类型选择规则（只能选一个）：
- ecommerce：物品损坏/缺失/明显老化，推荐换新
- local：大件家电/家具不便处理，推荐上门回收/清洗/维修等本地服务
- resale：物品状态完好但用户可能闲置，推荐二手出售
- tips：不需要消费，给一条养护或使用小贴士（如蔫绿植浇水）

兜底：若无法识别物品，object.name = "未知物品"，type 固定为 "tips"，给一条通用提示。
日记必须 ≤ 100 字（中文按字符计），不要超出。`;

export const USER_TEXT = '请分析这张物品照片，按上述 JSON 严格输出。';
```

- [ ] **Step 2：提交**

```bash
git add server/src/prompt.ts
git commit -m "feat(server): add claude prompt template"
```

---

## Task 4：JSON 抽取容错（TDD）

**Files:**
- Create: `server/src/claude.ts`
- Test: `server/tests/claude.test.ts`

- [ ] **Step 1：写失败的测试 `server/tests/claude.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { extractJson } from '../src/claude.ts';

describe('extractJson', () => {
  it('parses pure JSON', () => {
    const raw = '{"object":{"name":"杯子","state":"新"},"diary":"我是杯子","recommend":{"type":"tips","title":"t","reason":"r","keyword":"","cta":"c"}}';
    expect(extractJson(raw).object.name).toBe('杯子');
  });

  it('extracts JSON wrapped in noise', () => {
    const raw = '好的，结果如下：\n```json\n{"object":{"name":"鞋","state":"旧"},"diary":"d","recommend":{"type":"resale","title":"t","reason":"r","keyword":"k","cta":"c"}}\n```\n以上。';
    expect(extractJson(raw).recommend.type).toBe('resale');
  });

  it('throws on unparseable text', () => {
    expect(() => extractJson('what?')).toThrow();
  });
});
```

- [ ] **Step 2：跑测试，确认失败**

Run: `cd server && npm test`
Expected: FAIL，`extractJson is not a function` 或类似报错。

- [ ] **Step 3：写最小实现 `server/src/claude.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, USER_TEXT } from './prompt.ts';

export interface ScanResult {
  object: { name: string; state: string };
  diary: string;
  recommend: {
    type: 'ecommerce' | 'local' | 'resale' | 'tips';
    title: string;
    reason: string;
    keyword: string;
    cta: string;
  };
}

export function extractJson(raw: string): ScanResult {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as ScanResult;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON object found');
    return JSON.parse(match[0]) as ScanResult;
  }
}

export async function callClaude(imageDataUrl: string): Promise<ScanResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const [meta, base64] = imageDataUrl.split(',');
  const mediaType = (meta.match(/data:(image\/\w+);base64/)?.[1] ?? 'image/jpeg') as
    'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: USER_TEXT }
      ]
    }]
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');
  return extractJson(text);
}
```

- [ ] **Step 4：跑测试，确认通过**

Run: `cd server && npm test`
Expected: 3 个测试 PASS。

- [ ] **Step 5：提交**

```bash
git add server/src/claude.ts server/tests/claude.test.ts
git commit -m "feat(server): claude call with tolerant json extraction"
```

---

## Task 5：/api/scan 端点（TDD）

**Files:**
- Create: `server/src/scan.ts`
- Create: `server/src/index.ts`
- Test: `server/tests/scan.test.ts`

- [ ] **Step 1：写失败的端点测试 `server/tests/scan.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../src/claude.ts', () => ({
  callClaude: vi.fn(async () => ({
    object: { name: '杯子', state: '缺口' },
    diary: '我是杯子',
    recommend: { type: 'ecommerce', title: 't', reason: 'r', keyword: '杯子', cta: '去看看' }
  }))
}));

import { mountScan } from '../src/scan.ts';

function makeApp() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  mountScan(app);
  return app;
}

describe('POST /api/scan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with structured result', async () => {
    const res = await request(makeApp())
      .post('/api/scan')
      .send({ image: 'data:image/jpeg;base64,/9j/AAA' });
    expect(res.status).toBe(200);
    expect(res.body.recommend.type).toBe('ecommerce');
  });

  it('rejects missing image with BAD_IMAGE', async () => {
    const res = await request(makeApp()).post('/api/scan').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_IMAGE');
  });

  it('rejects non data-url image with BAD_IMAGE', async () => {
    const res = await request(makeApp()).post('/api/scan').send({ image: 'http://x/x.jpg' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_IMAGE');
  });
});
```

- [ ] **Step 2：装 supertest（测试用）**

Run: `cd server && npm install -D supertest @types/supertest`
Expected: 安装成功。

- [ ] **Step 3：跑测试，确认失败**

Run: `cd server && npm test`
Expected: FAIL，`mountScan is not a function`。

- [ ] **Step 4：写 `server/src/scan.ts`**

```ts
import type { Express, Request, Response } from 'express';
import { callClaude } from './claude.ts';

const MAX_BYTES = 2 * 1024 * 1024;

export function mountScan(app: Express): void {
  app.post('/api/scan', async (req: Request, res: Response) => {
    const image = req.body?.image;
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: { code: 'BAD_IMAGE', message: '缺少 image 或格式不支持' } });
    }
    const base64 = image.split(',', 2)[1] ?? '';
    const approxBytes = Math.floor(base64.length * 3 / 4);
    if (approxBytes > MAX_BYTES) {
      return res.status(400).json({ error: { code: 'BAD_IMAGE', message: '图片超过 2MB' } });
    }

    try {
      const result = await callClaude(image);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (/json/i.test(msg) || /no JSON/i.test(msg)) {
        return res.status(502).json({ error: { code: 'MODEL_FAILED', message: 'AI 走神了' } });
      }
      console.error('[scan] error:', err);
      res.status(500).json({ error: { code: 'INTERNAL', message: '服务器错误' } });
    }
  });
}
```

- [ ] **Step 5：写 `server/src/index.ts`**

```ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mountScan } from './scan.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
mountScan(app);
app.get('/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`[scan] listening on :${port}`));
```

- [ ] **Step 6：跑测试，确认全过**

Run: `cd server && npm test`
Expected: 全部 6 个测试 PASS（claude 3 个 + scan 3 个）。

- [ ] **Step 7：手动起服务做烟囱测试**

```bash
cd server
cp .env.example .env   # 把 ANTHROPIC_API_KEY 填成真值
npm run dev
# 另开终端
curl -s http://localhost:3000/health
```

Expected: `{"ok":true}`。

- [ ] **Step 8：提交**

```bash
git add server/src/scan.ts server/src/index.ts server/tests/scan.test.ts server/package.json server/package-lock.json
git commit -m "feat(server): /api/scan endpoint with validation and error codes"
```

---

## Task 6：前端项目初始化

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.js`
- Create: `web/index.html`
- Create: `web/src/styles.css`

- [ ] **Step 1：写 `web/package.json`**

```json
{
  "name": "ar-scan-web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview --host"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2：写 `web/vite.config.js`（代理后端）**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

- [ ] **Step 3：写 `web/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>万物皆可扫</title>
  <link rel="stylesheet" href="/src/styles.css" />
</head>
<body>
  <main id="app">
    <!-- 拍照屏 -->
    <section id="screen-capture" class="screen active">
      <div class="finder">
        <div class="corner tl"></div><div class="corner tr"></div>
        <div class="corner bl"></div><div class="corner br"></div>
        <p class="hint">把物品放进框里，看看它想说啥</p>
      </div>
      <div class="dock">
        <label class="album">
          相册
          <input id="file-album" type="file" accept="image/*" hidden />
        </label>
        <label class="shutter" aria-label="拍照">
          <input id="file-camera" type="file" accept="image/*" capture="environment" hidden />
        </label>
        <span class="placeholder-btn">闪光</span>
      </div>
    </section>

    <!-- 扫描中屏 -->
    <section id="screen-scanning" class="screen">
      <div class="preview"><img id="preview-img" alt="" /></div>
      <div class="scan-line"></div>
      <p class="status">AI 正在阅读……</p>
    </section>

    <!-- 结果屏 -->
    <section id="screen-result" class="screen">
      <header class="result-head">
        <img id="thumb" alt="" />
        <div>
          <div class="tag" id="obj-name">—</div>
          <div class="state" id="obj-state">—</div>
        </div>
      </header>
      <article class="diary-card">
        <span class="quote">「</span>
        <p id="diary-text">—</p>
      </article>
      <article class="service-card" id="service-card">
        <h3 id="svc-title">—</h3>
        <p id="svc-reason">—</p>
        <button id="svc-cta" type="button">—</button>
        <p id="svc-tip" hidden></p>
      </article>
      <button id="retake" class="ghost" type="button">再扫一个</button>
    </section>

    <!-- 错误屏（嵌在结果屏内） -->
    <template id="tpl-error">
      <article class="error-card">
        <p>AI 走神了，再试一次。</p>
        <button id="retry" type="button">重试</button>
      </article>
    </template>
  </main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4：写 `web/src/styles.css`**

```css
:root {
  --bg: #fff7ef;
  --orange: #ff7a3d;
  --ink: #1c1917;
  --muted: #78716c;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--ink);
}
.screen { display: none; min-height: 100vh; padding: 16px; }
.screen.active { display: block; }

/* 拍照屏 */
#screen-capture { position: relative; padding: 0; height: 100vh; background: #1c1917; }
.finder { position: absolute; inset: 64px 24px 160px; border-radius: 16px; }
.corner { position: absolute; width: 24px; height: 24px; border: 3px solid var(--orange); }
.corner.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 8px; }
.corner.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 8px; }
.corner.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 8px; }
.corner.br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 8px; }
.hint { position: absolute; bottom: -40px; left: 0; right: 0; text-align: center; color: #fff; opacity: .7; }
.dock { position: absolute; bottom: 24px; left: 0; right: 0; display: flex; justify-content: space-around; align-items: center; color: #fff; }
.album, .placeholder-btn { font-size: 14px; opacity: .8; cursor: pointer; }
.shutter {
  width: 72px; height: 72px; border-radius: 50%;
  background: #fff; border: 6px solid var(--orange);
  cursor: pointer;
}

/* 扫描中屏 */
#screen-scanning { background: #1c1917; color: #fff; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 24px; }
#screen-scanning.active { display: flex; }
.preview { width: 80vw; max-width: 320px; aspect-ratio: 1; overflow: hidden; border-radius: 16px; position: relative; }
.preview img { width: 100%; height: 100%; object-fit: cover; }
.scan-line {
  width: 80vw; max-width: 320px; height: 3px; background: var(--orange);
  box-shadow: 0 0 12px var(--orange);
  animation: scan 1.6s ease-in-out infinite alternate;
}
@keyframes scan { from { transform: translateY(-120px); } to { transform: translateY(120px); } }
.status { opacity: .7; }

/* 结果屏 */
#screen-result { display: none; }
#screen-result.active { display: block; }
.result-head { display: flex; gap: 12px; align-items: center; padding: 8px 4px 16px; }
.result-head img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
.tag { display: inline-block; padding: 2px 10px; background: var(--orange); color: #fff; border-radius: 999px; font-size: 13px; }
.state { color: var(--muted); font-size: 13px; margin-top: 4px; }

.diary-card {
  background: #fff; border-radius: 16px; padding: 20px 18px;
  position: relative; box-shadow: 0 4px 16px rgba(255,122,61,.08);
}
.diary-card .quote { color: var(--orange); font-size: 32px; line-height: 0; position: absolute; top: 18px; left: 14px; }
.diary-card p { padding-left: 18px; line-height: 1.7; font-size: 15px; }

.service-card {
  margin-top: 16px; background: #fff; border-radius: 16px; padding: 18px;
  border-left: 4px solid var(--orange);
}
.service-card h3 { font-size: 16px; margin-bottom: 6px; }
.service-card p { color: var(--muted); font-size: 14px; margin-bottom: 14px; }
.service-card button {
  background: var(--orange); color: #fff; border: 0;
  padding: 10px 18px; border-radius: 999px; font-size: 14px; cursor: pointer;
}
.service-card[data-type="local"]   { border-left-color: #2a9d8f; }
.service-card[data-type="resale"]  { border-left-color: #6a8eff; }
.service-card[data-type="tips"]    { border-left-color: #b08ce8; }

#retake { display: block; margin: 24px auto 8px; background: transparent; color: var(--muted); border: 1px solid var(--muted); padding: 8px 18px; border-radius: 999px; }

.error-card { background: #fff; border-radius: 16px; padding: 18px; text-align: center; margin-top: 16px; }
.error-card button { margin-top: 12px; background: var(--orange); color: #fff; border: 0; padding: 8px 18px; border-radius: 999px; }
```

- [ ] **Step 5：装依赖**

Run: `cd web && npm install`
Expected: 安装成功。

- [ ] **Step 6：提交**

```bash
git add web/package.json web/package-lock.json web/vite.config.js web/index.html web/src/styles.css
git commit -m "feat(web): vite scaffold and three-screen layout"
```

---

## Task 7：图片压缩工具

**Files:**
- Create: `web/src/compress.js`

- [ ] **Step 1：写 `web/src/compress.js`**

```js
// 把 File 压缩到 maxBytes 以内（默认 1.8MB 留点余量），返回 dataURL
export async function compressImage(file, maxBytes = 1.8 * 1024 * 1024) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  let { width, height } = bitmap;
  if (Math.max(width, height) > maxSide) {
    const ratio = maxSide / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (estimateBytes(dataUrl) > maxBytes && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (estimateBytes(dataUrl) > maxBytes) {
    throw new Error('图片太大，换张试试');
  }
  return dataUrl;
}

function estimateBytes(dataUrl) {
  const base64 = dataUrl.split(',', 2)[1] ?? '';
  return Math.floor(base64.length * 3 / 4);
}
```

- [ ] **Step 2：提交**

```bash
git add web/src/compress.js
git commit -m "feat(web): image compress to <=1.8mb"
```

---

## Task 8：API 封装

**Files:**
- Create: `web/src/api.js`

- [ ] **Step 1：写 `web/src/api.js`**

```js
export async function scan(imageDataUrl) {
  const resp = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl })
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const code = body?.error?.code ?? 'NETWORK';
    throw new Error(code);
  }
  return resp.json();
}
```

- [ ] **Step 2：提交**

```bash
git add web/src/api.js
git commit -m "feat(web): api wrapper with error code propagation"
```

---

## Task 9：状态机与界面联动

**Files:**
- Create: `web/src/main.js`

- [ ] **Step 1：写 `web/src/main.js`**

```js
import { compressImage } from './compress.js';
import { scan } from './api.js';

const screens = {
  capture: document.querySelector('#screen-capture'),
  scanning: document.querySelector('#screen-scanning'),
  result: document.querySelector('#screen-result')
};
function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

const fileCamera = document.querySelector('#file-camera');
const fileAlbum = document.querySelector('#file-album');
const shutter = document.querySelector('.shutter');
shutter.addEventListener('click', () => fileCamera.click());

fileCamera.addEventListener('change', e => onPick(e.target.files?.[0]));
fileAlbum.addEventListener('change', e => onPick(e.target.files?.[0]));
document.querySelector('#retake').addEventListener('click', () => {
  fileCamera.value = ''; fileAlbum.value = '';
  show('capture');
});

let lastDataUrl = null;
async function onPick(file) {
  if (!file) return;
  try {
    lastDataUrl = await compressImage(file);
  } catch (err) {
    alert(err.message ?? '图片处理失败');
    return;
  }
  document.querySelector('#preview-img').src = lastDataUrl;
  show('scanning');
  runScan();
}

async function runScan() {
  try {
    const data = await scan(lastDataUrl);
    renderResult(data);
    show('result');
  } catch (err) {
    renderError(err.message);
    show('result');
  }
}

function renderResult(data) {
  document.querySelector('#thumb').src = lastDataUrl;
  document.querySelector('#obj-name').textContent = data.object?.name ?? '未知物品';
  document.querySelector('#obj-state').textContent = data.object?.state ?? '';
  document.querySelector('#diary-text').textContent = data.diary ?? '';

  const card = document.querySelector('#service-card');
  card.hidden = false;
  card.dataset.type = data.recommend?.type ?? 'tips';
  document.querySelector('#svc-title').textContent = data.recommend?.title ?? '';
  document.querySelector('#svc-reason').textContent = data.recommend?.reason ?? '';

  const cta = document.querySelector('#svc-cta');
  const tip = document.querySelector('#svc-tip');
  cta.textContent = data.recommend?.cta ?? '查看';
  tip.hidden = true;

  cta.onclick = () => {
    const kw = encodeURIComponent(data.recommend?.keyword ?? '');
    const type = data.recommend?.type;
    if (type === 'ecommerce') location.href = `https://s.taobao.com/search?q=${kw}`;
    else if (type === 'local')  location.href = `https://i.meituan.com/s/${kw}`;
    else if (type === 'resale') location.href = `https://2.taobao.com/search.htm?q=${kw}`;
    else { tip.hidden = false; tip.textContent = data.recommend?.reason ?? ''; }
  };

  removeError();
}

function renderError(code) {
  document.querySelector('#service-card').hidden = true;
  document.querySelector('#diary-text').textContent = '';
  document.querySelector('#obj-name').textContent = '出错了';
  document.querySelector('#obj-state').textContent = code ?? '';

  removeError();
  const tpl = document.querySelector('#tpl-error');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('#retry').addEventListener('click', () => {
    show('scanning');
    runScan();
  });
  document.querySelector('#screen-result').appendChild(node);
}
function removeError() {
  document.querySelector('#screen-result .error-card')?.remove();
}
```

- [ ] **Step 2：提交**

```bash
git add web/src/main.js
git commit -m "feat(web): state machine and result rendering with 4 service types"
```

---

## Task 10：端到端联调

**Files:** 无新文件，仅手动验证。

- [x] **Step 1：起后端**

```bash
cd server
# 确保 .env 里 ANTHROPIC_API_KEY 已填
npm run dev
```

Expected: `[scan] listening on :3000`。

> ✅ 已验证：服务在 :3000 监听，`curl /health` → `{"ok":true}`。
> 另：自动化校验全部通过——`npm test` 6/6 PASS、`tsc --noEmit` 0 错误。
> 实测一次真·端到端调用（缺口马克杯测试图 → relay → claude-opus-4-7）：
> HTTP 200，返回 `object=陶瓷马克杯/杯口有缺损`、56 字第一人称日记（≤100 ✓）、
> `recommend.type=ecommerce`（符合"损坏→换新"规则）。两条 BAD_IMAGE 错误路径亦返回正确。

- [x] **Step 2：起前端**  ✅ 真机已访问

```bash
# 另开终端
cd web && npm run dev
```

Expected: Vite 输出 Local: `http://localhost:5173/` 与 Network 地址。

> ✅ 已验证：手机经手机热点访问 `http://172.20.10.2:5173` 可正常打开。
> 联调中发现并修复三处前端 bug（提交 `405c667`）：
> 1. 拍照 input 嵌在 `<label>` 内 + JS 手动 `.click()` 造成双触发，iOS 拍完卡在拍照屏；
> 2. `createImageBitmap` 对 iPhone HEIC 不稳，改 `<img>`+objectURL；
> 3. 扫描线在 `.preview` 框外，移入框内并改 `top` 动画。

- [ ] **Step 3：电脑模拟移动端**  ⏳ 已用真机替代（见 Step 4）

Chrome DevTools → Toggle device toolbar → iPhone 14。打开 `http://localhost:5173`，从相册选一张缺口杯图片，应：

- 看到扫描动效
- 进入结果屏，显示物品名+状态、≤100 字日记、ecommerce 类服务卡
- 点"去看看"跳到淘宝搜索

- [ ] **Step 4：真机验证**  ⏳ 待人工（环境已就绪，拍照闭环已通；剩三类样图核对未做）

手机和电脑同 WiFi，浏览器输 `电脑局域网IP:5173`。点快门唤起相机，拍三类样图：

- 缺口杯 → 期望 ecommerce
- 蔫绿植 → 期望 tips
- 完好旧鞋 → 期望 resale 或 ecommerce（任意合理）

记录结果是否符合服务匹配规则。

> ⏳ 2026-06-16 暂缓：真机已能拍照、跑通完整闭环（拍照→扫描动效→结果屏），
> 但三类样图（缺口杯/蔫绿植/完好旧鞋）的服务类型核对尚未人工执行。环境随时可继续。

- [ ] **Step 5：错误路径验证**  ⏳ 待人工（未执行）

后端关掉，前端再扫一次：应显示"AI 走神了，再试一次"和重试按钮。重启后端，点重试应恢复。

> 注：后端侧错误码已用 curl 验证（BAD_IMAGE 两路 → 400）。此步剩下的是前端 UI 呈现，需人工。

- [ ] **Step 6：最终提交（如有微调）**  ✅ 已提交 `claude-opus-4-7` 模型微调（754de93）

- [ ] **Step 6：最终提交（如有微调）**

```bash
git status
# 若上述步骤产出了样图或微调，按需提交
git add .
git commit -m "chore: e2e verification artifacts" || true
```

---

## Self-Review

- **Spec coverage**：拍照屏 / 扫描动效 / 结果屏 / 4 类服务卡 / 跳转目标 / 2MB 限制 / 100 字限制 / 三种错误码 / 兜底 tips / 两个后端单测——全部映射到 Task 4–10。
- **Placeholder scan**：无 TBD/TODO/类似占位。
- **Type consistency**：`ScanResult` 在 Task 4 定义，Task 5 复用；前端字段读取与 spec 字段一一对应。
