import { compressImage } from './compress.js';
import { scan } from './api.js';

const screens = {
  capture: document.querySelector('#screen-capture'),
  scanning: document.querySelector('#screen-scanning'),
  result: document.querySelector('#screen-result')
};

const copy = {
  captureHint: document.querySelector('#capture-hint'),
  resultType: document.querySelector('#svc-type-label')
};

const lightbox = {
  root: document.querySelector('#image-lightbox'),
  image: document.querySelector('#lightbox-image')
};

const serviceTypeMap = {
  ecommerce: '建议换新',
  local: '建议找本地服务',
  resale: '建议转卖',
  tips: '建议这样处理'
};

function show(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

const fileCamera = document.querySelector('#file-camera');
const fileAlbum = document.querySelector('#file-album');
const thumbButton = document.querySelector('#thumb-button');
const lightboxClose = document.querySelector('#lightbox-close');

document.querySelector('#btn-shutter').addEventListener('click', () => fileCamera.click());
document.querySelector('#btn-album').addEventListener('click', () => fileAlbum.click());
document.querySelector('#btn-demo').addEventListener('click', () => {
  if (copy.captureHint) {
    copy.captureHint.textContent = '可以试试旧玩具、杯子、摆件、闲置数码，故事感会更强。';
  }
});

fileCamera.addEventListener('change', (event) => onPick(event.target.files?.[0]));
fileAlbum.addEventListener('change', (event) => onPick(event.target.files?.[0]));
document.querySelector('#retake').addEventListener('click', () => {
  fileCamera.value = '';
  fileAlbum.value = '';
  if (copy.captureHint) {
    copy.captureHint.textContent = '优先拍正面，光线均匀一点，识别会更稳。';
  }
  show('capture');
});

thumbButton.addEventListener('click', () => openLightbox(lastDataUrl));
lightboxClose.addEventListener('click', closeLightbox);
lightbox.root.addEventListener('click', (event) => {
  if (event.target === lightbox.root) {
    closeLightbox();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLightbox();
  }
});

let lastDataUrl = null;

async function onPick(file) {
  if (!file) return;

  try {
    lastDataUrl = await compressImage(file);
  } catch (err) {
    if (copy.captureHint) {
      copy.captureHint.textContent = `图片处理失败：${err?.message ?? err}`;
    }
    return;
  }

  document.querySelector('#preview-img').src = lastDataUrl;
  show('scanning');
  runScan();
}

let timerId = null;

function startTimer() {
  const timer = document.querySelector('#scan-timer');
  const startedAt = Date.now();
  stopTimer();

  if (timer) {
    timer.textContent = '0.0s';
  }

  timerId = setInterval(() => {
    if (timer) {
      timer.textContent = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    }
  }, 100);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

async function runScan() {
  startTimer();
  try {
    const data = await scan(lastDataUrl);
    stopTimer();
    renderResult(data);
    show('result');
  } catch (err) {
    stopTimer();
    renderError(err.message);
    show('result');
  }
}

function renderResult(data) {
  document.querySelector('#thumb').src = lastDataUrl;
  document.querySelector('#obj-name').textContent = data.object?.name ?? '未识别物品';
  document.querySelector('#obj-state').textContent = data.object?.state ?? '状态暂时看起来正常，未见明显异常。';
  document.querySelector('#diary-text').textContent = data.diary ?? '这件物品暂时还没整理出清晰故事。';

  const card = document.querySelector('#service-card');
  const type = data.recommend?.type ?? 'tips';
  card.hidden = false;
  card.dataset.type = type;

  if (copy.resultType) {
    copy.resultType.textContent = serviceTypeMap[type] ?? serviceTypeMap.tips;
  }

  document.querySelector('#svc-title').textContent = data.recommend?.title ?? '先保留一下这件物品';
  document.querySelector('#svc-reason').textContent = data.recommend?.reason ?? '目前更适合先收藏这次识别结果。';

  const cta = document.querySelector('#svc-cta');
  const tip = document.querySelector('#svc-tip');
  cta.textContent = data.recommend?.cta ?? '查看建议';
  tip.hidden = true;

  cta.onclick = () => {
    const keyword = encodeURIComponent(data.recommend?.keyword ?? '');
    if (type === 'ecommerce') {
      location.href = `https://s.taobao.com/search?q=${keyword}`;
      return;
    }
    if (type === 'local') {
      location.href = `https://i.meituan.com/s/${keyword}`;
      return;
    }
    if (type === 'resale') {
      location.href = `https://2.taobao.com/search.htm?q=${keyword}`;
      return;
    }

    tip.hidden = false;
    tip.textContent = data.recommend?.detail ?? data.recommend?.reason ?? '先从最容易执行的一步开始。';
  };

  removeError();
}

function renderError(code) {
  document.querySelector('#service-card').hidden = true;
  document.querySelector('#diary-text').textContent = '';
  document.querySelector('#obj-name').textContent = code === 'TIMEOUT' ? '识别超时' : '出错了';
  document.querySelector('#obj-state').textContent = formatErrorMessage(code);
  document.querySelector('#thumb').src = lastDataUrl ?? '';

  if (copy.resultType) {
    copy.resultType.textContent = '识别异常';
  }

  removeError();
  const tpl = document.querySelector('#tpl-error');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.error-text').textContent = formatErrorMessage(code);
  node.querySelector('#retry').addEventListener('click', () => {
    show('scanning');
    runScan();
  });
  document.querySelector('#screen-result').appendChild(node);
}

function removeError() {
  document.querySelector('#screen-result .error-card')?.remove();
}

function openLightbox(src) {
  if (!src) return;
  lightbox.image.src = src;
  lightbox.root.hidden = false;
}

function closeLightbox() {
  lightbox.root.hidden = true;
  lightbox.image.removeAttribute('src');
}

function formatErrorMessage(code) {
  if (code === 'TIMEOUT') return '这次分析超过 60 秒，换一张更清晰的图再试试。';
  if (code === 'BAD_IMAGE') return '图片格式或大小不太合适，建议重新选择一张。';
  if (code === 'MODEL_FAILED') return '模型这次没有稳定返回结果，重试通常可以恢复。';
  if (code === 'NETWORK') return '网络连接出了点问题，确认服务和网络后再试。';
  return '暂时没拿到可用结果，可以重新扫描一次。';
}
