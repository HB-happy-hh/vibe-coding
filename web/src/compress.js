// 把 File 压缩到 maxBytes 以内（默认 1.8MB 留点余量），返回 dataURL
export async function compressImage(file, maxBytes = 1.8 * 1024 * 1024) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  let { width, height } = bitmap;
  if (Math.max(width, height) > maxSide) {
    const ratio = maxSide / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (estimateBytes(dataUrl) > maxBytes && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (estimateBytes(dataUrl) > maxBytes) {
    throw new Error('图片太大，换张试试');
  }
  return dataUrl;
}

function estimateBytes(dataUrl) {
  const base64 = dataUrl.split(',', 2)[1] ?? '';
  return Math.floor(base64.length * 3 / 4);
}
