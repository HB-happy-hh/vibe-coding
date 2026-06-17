import type { Express, Request, Response } from 'express';
import { callVision } from './vision.ts';
import type { ScanResult } from './vision.ts';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Framework-agnostic core — used by both Express (local) and Vercel serverless.
 * Validates image format & size, then calls the vision model.
 */
export async function runScan(image: string): Promise<ScanResult> {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    throw Object.assign(new Error('BAD_IMAGE'), { code: 'BAD_IMAGE' as const });
  }
  const base64 = image.split(',', 2)[1] ?? '';
  const approxBytes = Math.floor(base64.length * 3 / 4);
  if (approxBytes > MAX_BYTES) {
    throw Object.assign(new Error('BAD_IMAGE'), { code: 'BAD_IMAGE' as const });
  }

  return callVision(image);
}

/**
 * Express flavour — maps runScan onto POST /api/scan.
 */
export function mountScan(app: Express): void {
  app.post('/api/scan', async (req: Request, res: Response) => {
    const image = req.body?.image;

    try {
      const result = await runScan(image);
      res.json(result);
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
      console.error('[scan] error:', msg);
      res.status(500).json({ error: { code: 'INTERNAL', message: '服务器错误' } });
    }
  });
}
