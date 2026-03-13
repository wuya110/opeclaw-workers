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
  } catch (error) {
    answerBox.textContent = `调用失败：${error.message}`;
    resultBox.textContent = `调用失败：${error.message}`;
    metaTag.textContent = '请求失败';
    metaTag.className = 'meta-tag danger';
  }
});
