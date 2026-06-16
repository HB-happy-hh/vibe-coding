export async function scan(imageDataUrl) {
  const resp = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl })
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const code = body?.error?.code ?? 'NETWORK';
    throw new Error(code);
  }
  return resp.json();
}
