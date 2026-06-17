const TIMEOUT_MS = 60_000;

export async function scan(imageDataUrl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl }),
      signal: ctrl.signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('TIMEOUT');
    throw new Error('NETWORK');
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const code = body?.error?.code ?? 'NETWORK';
    throw new Error(code);
  }
  return resp.json();
}
