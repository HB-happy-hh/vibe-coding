import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../src/vision.ts', () => ({
  callVision: vi.fn(async () => ({
    object: { name: '杯子', state: '缺口' },
    diary: '我是杯子',
    recommend: { type: 'ecommerce', title: 't', reason: 'r', detail: 'd', keyword: '杯子', cta: '去看看' }
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
