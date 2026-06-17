import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// ── Prompt (inline — Vercel does not bundle cross-directory) ──

const SYSTEM_PROMPT = `你是"万物皆可扫"应用里的物品观察者。看到一张物品照片后，你必须严格只输出一个 JSON 对象，不要 Markdown 代码块、不要前后解释。
JSON 字段（全部必填）：
{
  "object": { "name": string, "state": string }, // state 必须是"状态结论 + 简短依据"，不要只写"良好/一般/破损"
  "diary":  string,            // 以该物品的第一人称写的日记，中文 70～100 字，自然口吻
  "recommend": {
    "type":    "ecommerce" | "local" | "resale" | "tips",
    "title":   string,         // 适合卡片标题，12 字以内
    "reason":  string,         // 一句话摘要，30 字以内，不要与 title 或 detail 重复
    "detail":  string,         // 展开后的详细建议，40-80 字，要比 reason 更具体、更有画面感
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
写作要求：
- object.state 必须让用户看懂你为什么这么判断，例如"状态良好，未见明显污渍或破损""略有旧感，边缘有使用痕迹"
- 不要只返回"良好 / 完好 / 一般 / 较旧 / 破损"这类单独标签
- title、reason、detail 三者不能互相改写重复
- detail 要像有经验的人在认真给建议，不要空话，不要模板腔
- 如果 type = "tips"，detail 优先写可直接执行的做法或观察点
日记必须控制在 70～100 字之间（中文按字符计），不少于 70 字、不超过 100 字。`;

const USER_TEXT = '请分析这张物品照片，按上述 JSON 严格输出。';

// ── Types ──

interface ScanResult {
  object: { name: string; state: string };
  diary: string;
  recommend: {
    type: 'ecommerce' | 'local' | 'resale' | 'tips';
    title: string;
    reason: string;
    detail: string;
    keyword: string;
    cta: string;
  };
}

// ── Normalise & dedupe (mirrors server/src/vision.ts) ──

function dedupeRecommend(result: ScanResult): ScanResult {
  const recommend = result.recommend ?? {} as ScanResult['recommend'];
  const title = (recommend.title ?? '').trim();
  const reason = (recommend.reason ?? '').trim();
  const detail = (recommend.detail ?? '').trim();

  const fallbackDetail = detail || reason || `${title}，先从最容易执行的一步开始。`;
  const nextReason = reason && reason !== title
    ? reason
    : detail && detail !== title
      ? detail.slice(0, 30)
      : `${title}，值得现在就处理一下。`;
  const nextDetail = fallbackDetail === nextReason
    ? `${fallbackDetail} 先观察它现在的状态，再决定是继续使用、养护还是换个去处。`
    : fallbackDetail;

  return {
    ...result,
    recommend: { ...recommend, title, reason: nextReason, detail: nextDetail, keyword: recommend.keyword ?? '', cta: recommend.cta ?? '查看建议' },
  };
}

function normalizeState(state: string, name = ''): string {
  const text = (state ?? '').trim();
  if (!text) return name ? '状态暂时看起来正常，未见明显异常' : '状态暂时看起来正常，未见明显异常';

  const directTags = new Set(['良好', '完好', '一般', '较旧', '破损', '正常', '新', '旧']);
  if (!text.includes('，') && !text.includes('。') && directTags.has(text)) {
    const base: Record<string, string> = {
      良好: '状态良好，未见明显磨损或污渍',
      完好: '状态完好，表面未见明显损伤',
      一般: '状态一般，能看出一些使用痕迹',
      较旧: '略有旧感，边缘能看出使用痕迹',
      破损: '状态受损，已经能看出明显破坏',
      正常: '状态正常，暂时未见明显异常',
      新: '状态较新，外观比较完整',
      旧: '状态偏旧，表面有一定使用痕迹',
    };
    return base[text] ?? `${name ? `${name} ` : ''}${text}`;
  }
  return text;
}

// ── JSON extraction (mirrors server/src/vision.ts) ──

function extractJson(raw: string): ScanResult {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as ScanResult;
    parsed.object = { ...parsed.object, state: normalizeState(parsed.object?.state ?? '', parsed.object?.name ?? '') };
    return dedupeRecommend(parsed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON object found');
    const parsed = JSON.parse(match[0]) as ScanResult;
    parsed.object = { ...parsed.object, state: normalizeState(parsed.object?.state ?? '', parsed.object?.name ?? '') };
    return dedupeRecommend(parsed);
  }
}

// ── Vision call (mirrors server/src/vision.ts) ──

async function callVision(imageDataUrl: string): Promise<ScanResult> {
  const client = new OpenAI({
    apiKey: process.env.QWEN_API_KEY,
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });

  const resp = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || 'qwen-vl-plus',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: SYSTEM_PROMPT + '\n' + USER_TEXT },
      ],
    }],
  });

  const choice = resp.choices?.[0];
  console.log('[vision] model:', resp.model, '| tokens:', resp.usage?.total_tokens);
  console.log('[vision] finish_reason:', choice?.finish_reason);

  const text = typeof choice?.message?.content === 'string' ? choice.message.content : '';
  try {
    return extractJson(text);
  } catch (err) {
    console.error('[vision] extractJson failed. Raw text (first 500 chars):', text.slice(0, 500));
    throw err;
  }
}

// ── Validation (mirrors server/src/run-scan.ts) ──

const MAX_BYTES = 2 * 1024 * 1024;

async function runScan(image: unknown): Promise<ScanResult> {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    throw Object.assign(new Error('BAD_IMAGE'), { code: 'BAD_IMAGE' as const });
  }
  const base64 = image.split(',', 2)[1] ?? '';
  if (Math.floor((base64.length * 3) / 4) > MAX_BYTES) {
    throw Object.assign(new Error('BAD_IMAGE'), { code: 'BAD_IMAGE' as const });
  }
  return callVision(image);
}

// ── Vercel handler ──

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST' } });
  }

  try {
    const result = await runScan(req.body?.image);
    return res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    const code: string = (err instanceof Error && 'code' in err)
      ? (err as Error & { code?: string }).code ?? 'INTERNAL'
      : 'INTERNAL';

    if (code === 'BAD_IMAGE') {
      return res.status(400).json({ error: { code: 'BAD_IMAGE', message: '缺少 image 或格式不支持' } });
    }
    if (/json/i.test(msg) || /no JSON/i.test(msg)) {
      return res.status(502).json({ error: { code: 'MODEL_FAILED', message: 'AI 走神了' } });
    }
    console.error('[api/scan] error:', msg);
    return res.status(500).json({ error: { code: 'INTERNAL', message: '服务器错误' } });
  }
}
