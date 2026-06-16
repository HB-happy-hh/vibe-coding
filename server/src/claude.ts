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
