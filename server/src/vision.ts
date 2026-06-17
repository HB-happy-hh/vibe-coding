import OpenAI from 'openai';
import { SYSTEM_PROMPT, USER_TEXT } from './prompt.ts';

export interface ScanResult {
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
    recommend: {
      ...recommend,
      title,
      reason: nextReason,
      detail: nextDetail,
      keyword: recommend.keyword ?? '',
      cta: recommend.cta ?? '查看建议',
    }
  };
}

function normalizeState(state: string, name = ''): string {
  const text = (state ?? '').trim();
  if (!text) {
    return name ? `状态暂时看起来正常，未见明显异常` : '状态暂时看起来正常，未见明显异常';
  }

  const directTags = new Set(['良好', '完好', '一般', '较旧', '破损', '正常', '新', '旧']);
  if (!text.includes('，') && !text.includes('。') && directTags.has(text)) {
    const base = {
      良好: '状态良好，未见明显磨损或污渍',
      完好: '状态完好，表面未见明显损伤',
      一般: '状态一般，能看出一些使用痕迹',
      较旧: '略有旧感，边缘能看出使用痕迹',
      破损: '状态受损，已经能看出明显破坏',
      正常: '状态正常，暂时未见明显异常',
      新: '状态较新，外观比较完整',
      旧: '状态偏旧，表面有一定使用痕迹'
    } as const;
    return base[text as keyof typeof base] ?? `${name ? `${name} ` : ''}${text}`;
  }

  return text;
}

export function extractJson(raw: string): ScanResult {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as ScanResult;
    parsed.object = {
      ...parsed.object,
      state: normalizeState(parsed.object?.state ?? '', parsed.object?.name ?? ''),
    };
    return dedupeRecommend(parsed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON object found');
    const parsed = JSON.parse(match[0]) as ScanResult;
    parsed.object = {
      ...parsed.object,
      state: normalizeState(parsed.object?.state ?? '', parsed.object?.name ?? ''),
    };
    return dedupeRecommend(parsed);
  }
}

export async function callVision(imageDataUrl: string): Promise<ScanResult> {
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
        { type: 'text', text: SYSTEM_PROMPT + '\n' + USER_TEXT }
      ]
    }]
  });

  const choice = resp.choices?.[0];
  // dump full response structure for debugging
  console.log('[vision] model:', resp.model, '| tokens:', resp.usage?.total_tokens);
  console.log('[vision] finish_reason:', choice?.finish_reason);
  console.log('[vision] message keys:', Object.keys(choice?.message ?? {}));
  console.log('[vision] raw message:', JSON.stringify(choice?.message, null, 2).slice(0, 800));

  const text = typeof choice?.message?.content === 'string'
    ? choice.message.content
    : '';
  try {
    return extractJson(text);
  } catch (err) {
    console.error('[vision] extractJson failed. Raw text (first 500 chars):', text.slice(0, 500));
    throw err;
  }
}
