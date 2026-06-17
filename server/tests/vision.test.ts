import { describe, it, expect } from 'vitest';
import { extractJson } from '../src/vision.ts';

describe('extractJson', () => {
  it('parses pure JSON', () => {
    const raw = '{"object":{"name":"杯子","state":"新"},"diary":"我是杯子","recommend":{"type":"tips","title":"t","reason":"r","detail":"d","keyword":"","cta":"c"}}';
    expect(extractJson(raw).object.name).toBe('杯子');
  });

  it('extracts JSON wrapped in noise', () => {
    const raw = '好的，结果如下：\n```json\n{"object":{"name":"鞋","state":"旧"},"diary":"d","recommend":{"type":"resale","title":"t","reason":"r","detail":"d2","keyword":"k","cta":"c"}}\n```\n以上。';
    expect(extractJson(raw).recommend.type).toBe('resale');
  });

  it('fills detail and reduces duplication when reason repeats title', () => {
    const raw = '{"object":{"name":"杯子","state":"新"},"diary":"我是杯子","recommend":{"type":"tips","title":"保持清洁","reason":"保持清洁","detail":"","keyword":"","cta":"看看"}}';
    const parsed = extractJson(raw);
    expect(parsed.recommend.reason).not.toBe(parsed.recommend.title);
    expect(parsed.recommend.detail.length).toBeGreaterThan(0);
  });

  it('expands state tags into explanatory text', () => {
    const raw = '{"object":{"name":"帽子","state":"良好"},"diary":"d","recommend":{"type":"tips","title":"t","reason":"r","detail":"d","keyword":"","cta":"c"}}';
    expect(extractJson(raw).object.state).toContain('状态良好');
  });

  it('throws on unparseable text', () => {
    expect(() => extractJson('what?')).toThrow();
  });
});
