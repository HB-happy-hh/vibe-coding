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
