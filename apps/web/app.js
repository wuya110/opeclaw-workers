const gatewayBase = 'https://api.yjs.de5.net';

const statusBox = document.querySelector('#statusBox');
const resultBox = document.querySelector('#resultBox');
const checkBtn = document.querySelector('#checkBtn');
const runBtn = document.querySelector('#runBtn');
const promptInput = document.querySelector('#prompt');

async function request(path, options = {}) {
  const response = await fetch(`${gatewayBase}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

checkBtn.addEventListener('click', async () => {
  statusBox.textContent = '检查中...';
  try {
    const [whoami, providers] = await Promise.all([
      request('/api/whoami'),
      request('/api/providers')
    ]);
    statusBox.textContent = JSON.stringify({ whoami, providers }, null, 2);
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
      body: JSON.stringify({ prompt })
    });
    resultBox.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultBox.textContent = `调用失败: ${error.message}`;
  }
});
