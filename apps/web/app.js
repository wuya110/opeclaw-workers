const gatewayInput = document.querySelector('#gatewayBase');
const saveGatewayBtn = document.querySelector('#saveGatewayBtn');
const gatewayInfoBox = document.querySelector('#gatewayInfoBox');
const statusBox = document.querySelector('#statusBox');
const resultBox = document.querySelector('#resultBox');
const answerBox = document.querySelector('#answerBox');
const metaTag = document.querySelector('#metaTag');
const checkBtn = document.querySelector('#checkBtn');
const runBtn = document.querySelector('#runBtn');
const promptInput = document.querySelector('#prompt');
const modelSelect = document.querySelector('#model');
const fallbackModelSelect = document.querySelector('#fallbackModel');
const maxTokensInput = document.querySelector('#maxTokens');
const temperatureInput = document.querySelector('#temperature');
const loadHistoryBtn = document.querySelector('#loadHistoryBtn');
const historyLimitInput = document.querySelector('#historyLimit');
const historyBox = document.querySelector('#historyBox');

const storageKey = 'opeclaw.gatewayBase';
const defaultGateway = 'https://api.yjs.de5.net';

gatewayInput.value = localStorage.getItem(storageKey) || defaultGateway;
gatewayInfoBox.textContent = `当前网关：${gatewayInput.value}`;

function getGatewayBase() {
  return gatewayInput.value.trim().replace(/\/$/, '') || defaultGateway;
}

async function request(path, options = {}) {
  const response = await fetch(`${getGatewayBase()}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadHistory() {
  historyBox.textContent = '加载中...';
  try {
    const limit = Number(historyLimitInput.value || 10);
    const result = await request(`/api/experiments?limit=${limit}`);
    const items = result.data?.items || [];

    if (!items.length) {
      historyBox.textContent = '暂无记录';
      return;
    }

    historyBox.innerHTML = items.map((item) => `
      <article class="history-item">
        <div class="history-item-head">
          <span class="history-id">#${item.id}</span>
          <span class="history-time">${escapeHtml(item.created_at)}</span>
        </div>
        <div class="history-models">
          <span>请求模型：${escapeHtml(item.requested_model)}</span>
          <span>最终模型：${escapeHtml(item.final_model)}</span>
          <span class="badge ${item.fallback_used ? 'warn' : 'ok'}">${item.fallback_used ? '发生回退' : '未回退'}</span>
        </div>
        <div class="history-block">
          <div class="history-label">Prompt</div>
          <div class="history-text">${escapeHtml(item.prompt)}</div>
        </div>
        <div class="history-block">
          <div class="history-label">Answer</div>
          <div class="history-text">${escapeHtml(item.answer || '')}</div>
        </div>
      </article>
    `).join('');
  } catch (error) {
    historyBox.textContent = `加载失败：${error.message}`;
  }
}

saveGatewayBtn.addEventListener('click', () => {
  localStorage.setItem(storageKey, getGatewayBase());
  gatewayInfoBox.textContent = `当前网关：${getGatewayBase()}`;
});

checkBtn.addEventListener('click', async () => {
  statusBox.textContent = '检查中...';
  try {
    const [health, whoami, providers] = await Promise.all([
      request('/health'),
      request('/api/whoami'),
      request('/api/providers')
    ]);
    statusBox.textContent = JSON.stringify({ health, whoami, providers }, null, 2);
  } catch (error) {
    statusBox.textContent = `检查失败: ${error.message}`;
  }
});

runBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    answerBox.textContent = '先输入 prompt';
    resultBox.textContent = '先输入 prompt';
    metaTag.textContent = '缺少输入';
    metaTag.className = 'meta-tag warn';
    return;
  }

  answerBox.textContent = '执行中...';
  resultBox.textContent = '执行中...';
  metaTag.textContent = '请求中';
  metaTag.className = 'meta-tag';

  try {
    const result = await request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: modelSelect.value,
        fallback_model: fallbackModelSelect.value,
        max_tokens: Number(maxTokensInput.value || 256),
        temperature: Number(temperatureInput.value || 0.7)
      })
    });

    const data = result.data || {};
    answerBox.textContent = data.answer || '模型没有返回可展示文本';
    if (data.fallbackUsed) {
      metaTag.textContent = `已回退：${data.primaryModel} → ${data.model}`;
      metaTag.className = 'meta-tag warn';
    } else {
      metaTag.textContent = `模型：${data.model || 'unknown'}`;
      metaTag.className = 'meta-tag ok';
    }
    resultBox.textContent = JSON.stringify(result, null, 2);
    await loadHistory();
  } catch (error) {
    answerBox.textContent = `调用失败：${error.message}`;
    resultBox.textContent = `调用失败：${error.message}`;
    metaTag.textContent = '请求失败';
    metaTag.className = 'meta-tag danger';
  }
});

loadHistoryBtn.addEventListener('click', loadHistory);
loadHistory();
