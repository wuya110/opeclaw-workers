const gatewayInput = document.querySelector('#gatewayBase');
const saveGatewayBtn = document.querySelector('#saveGatewayBtn');
const gatewayInfoBox = document.querySelector('#gatewayInfoBox');
const statusBox = document.querySelector('#statusBox');
const resultBox = document.querySelector('#resultBox');
const checkBtn = document.querySelector('#checkBtn');
const runBtn = document.querySelector('#runBtn');
const promptInput = document.querySelector('#prompt');
const modelSelect = document.querySelector('#model');
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
    resultBox.textContent = '先输入 prompt';
    return;
  }

  resultBox.textContent = '执行中...';
  try {
    const result = await request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: modelSelect.value,
        max_tokens: Number(maxTokensInput.value || 256),
        temperature: Number(temperatureInput.value || 0.7)
      })
    });
    resultBox.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultBox.textContent = `调用失败: ${error.message}`;
  }
});
