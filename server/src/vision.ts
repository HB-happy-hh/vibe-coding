import OpenAI from 'openai';
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
