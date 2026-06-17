import type { Express, Request, Response } from 'express';
import { runScan } from './run-scan';

export function mountScan(app: Express): void {
  app.post('/api/scan', async (req: Request, res: Response) => {
    const image = req.body?.image;

    try {
      const result = await runScan(image);
      res.json(result);
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

      console.error('[scan] error:', msg);
      res.status(500).json({
        error: { code: 'INTERNAL', message: '服务器错误' },
      });
    }
  });
}
