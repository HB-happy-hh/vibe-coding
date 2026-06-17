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
    apiKey: process.env.ZHIPU_API_KEY,
    baseURL: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
  });

  const resp = await client.chat.completions.create({
    model: 'glm-5v-turbo',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: SYSTEM_PROMPT + '\n' + USER_TEXT }
      ]
    }]
  });

  const text = resp.choices?.[0]?.message?.content ?? '';
  return extractJson(text);
}
