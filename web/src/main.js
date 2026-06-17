import { compressImage } from './compress.js';
import { scan } from './api.js';

const screens = {
  capture: document.querySelector('#screen-capture'),
  scanning: document.querySelector('#screen-scanning'),
  result: document.querySelector('#screen-result')
};
function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

const fileCamera = document.querySelector('#file-camera');
const fileAlbum = document.querySelector('#file-album');
const hint = document.querySelector('#screen-capture .hint');

document.querySelector('#btn-shutter').addEventListener('click', () => fileCamera.click());
document.querySelector('#btn-album').addEventListener('click', () => fileAlbum.click());

fileCamera.addEventListener('change', e => onPick(e.target.files?.[0]));
fileAlbum.addEventListener('change', e => onPick(e.target.files?.[0]));
document.querySelector('#retake').addEventListener('click', () => {
  fileCamera.value = ''; fileAlbum.value = '';
  show('capture');
});

let lastDataUrl = null;
async function onPick(file) {
  if (!file) return;
  try {
    lastDataUrl = await compressImage(file);
  } catch (err) {
    if (hint) hint.textContent = '图片处理失败：' + (err?.message ?? err);
    return;
  }
  document.querySelector('#preview-img').src = lastDataUrl;
  show('scanning');
  runScan();
}

let timerId = null;
function startTimer() {
  const el = document.querySelector('#scan-timer');
  const t0 = Date.now();
  if (el) el.textContent = '0.0s';
  stopTimer();
  timerId = setInterval(() => {
    if (el) el.textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's';
  }, 100);
}
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
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
  document.querySelector('#obj-name').textContent = data.object?.name ?? '未知物品';
  document.querySelector('#obj-state').textContent = data.object?.state ?? '';
  document.querySelector('#diary-text').textContent = data.diary ?? '';

  const card = document.querySelector('#service-card');
  card.hidden = false;
  card.dataset.type = data.recommend?.type ?? 'tips';
  document.querySelector('#svc-title').textContent = data.recommend?.title ?? '';
  document.querySelector('#svc-reason').textContent = data.recommend?.reason ?? '';

  const cta = document.querySelector('#svc-cta');
  const tip = document.querySelector('#svc-tip');
  cta.textContent = data.recommend?.cta ?? '查看';
  tip.hidden = true;

  cta.onclick = () => {
    const kw = encodeURIComponent(data.recommend?.keyword ?? '');
    const type = data.recommend?.type;
    if (type === 'ecommerce') location.href = `https://s.taobao.com/search?q=${kw}`;
    else if (type === 'local')  location.href = `https://i.meituan.com/s/${kw}`;
    else if (type === 'resale') location.href = `https://2.taobao.com/search.htm?q=${kw}`;
    else { tip.hidden = false; tip.textContent = data.recommend?.reason ?? ''; }
  };

  removeError();
}

function renderError(code) {
  document.querySelector('#service-card').hidden = true;
  document.querySelector('#diary-text').textContent = '';
  document.querySelector('#obj-name').textContent = code === 'TIMEOUT' ? '超时了' : '出错了';
  document.querySelector('#obj-state').textContent = code ?? '';

  removeError();
  const tpl = document.querySelector('#tpl-error');
  const node = tpl.content.firstElementChild.cloneNode(true);
  if (code === 'TIMEOUT') {
    node.querySelector('p').textContent = 'AI 想了 60 秒还没结果，再试一次。';
  }
  node.querySelector('#retry').addEventListener('click', () => {
    show('scanning');
    runScan();
  });
  document.querySelector('#screen-result').appendChild(node);
}
function removeError() {
  document.querySelector('#screen-result .error-card')?.remove();
}
