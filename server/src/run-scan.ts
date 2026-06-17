import { callVision } from './vision';
import type { ScanResult } from './vision';

const MAX_BYTES = 2 * 1024 * 1024;

export async function runScan(image: unknown): Promise<ScanResult> {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    throw Object.assign(new Error('BAD_IMAGE'), { code: 'BAD_IMAGE' as const });
  }

  const base64 = image.split(',', 2)[1] ?? '';
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw Object.assign(new Error('BAD_IMAGE'), { code: 'BAD_IMAGE' as const });
  }

  return callVision(image);
}
