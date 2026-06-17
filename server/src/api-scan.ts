import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runScan } from './run-scan';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST' },
    });
  }

  try {
    const result = await runScan(req.body?.image);
    return res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    const code =
      err instanceof Error && 'code' in err
        ? (err as Error & { code?: string }).code ?? 'INTERNAL'
        : 'INTERNAL';

    if (code === 'BAD_IMAGE') {
      return res.status(400).json({
        error: { code: 'BAD_IMAGE', message: '缺少 image 或格式不支持' },
      });
    }
    if (/json/i.test(msg) || /no JSON/i.test(msg)) {
      return res.status(502).json({
        error: { code: 'MODEL_FAILED', message: 'AI 走神了' },
      });
    }

    console.error('[api/scan] error:', msg);
    return res.status(500).json({
      error: { code: 'INTERNAL', message: '服务器错误' },
    });
  }
}
