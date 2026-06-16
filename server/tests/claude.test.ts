import { describe, it, expect } from 'vitest';
import { extractJson } from '../src/claude.ts';

describe('extractJson', () => {
  it('parses pure JSON', () => {
    const raw = '{"object":{"name":"杯子","state":"新"},"diary":"我是杯子","recommend":{"type":"tips","title":"t","reason":"r","keyword":"","cta":"c"}}';
    expect(extractJson(raw).object.name).toBe('杯子');
  });

  it('extracts JSON wrapped in noise', () => {
    const raw = '好的，结果如下：\n```json\n{"object":{"name":"鞋","state":"旧"},"diary":"d","recommend":{"type":"resale","title":"t","reason":"r","keyword":"k","cta":"c"}}\n```\n以上。';
    expect(extractJson(raw).recommend.type).toBe('resale');
  });

  it('throws on unparseable text', () => {
    expect(() => extractJson('what?')).toThrow();
  });
});
