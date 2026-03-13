const gatewayInput = document.querySelector('#gatewayBase');
const saveGatewayBtn = document.querySelector('#saveGatewayBtn');
const gatewayInfoBox = document.querySelector('#gatewayInfoBox');
const statusBox = document.querySelector('#statusBox');
const resultBox = document.querySelector('#resultBox');
const answerBox = document.querySelector('#answerBox');
const metaTag = document.querySelector('#metaTag');
const checkBtn = document.querySelector('#checkBtn');
const runBtn = document.querySelector('#runBtn');
const copyAnswerBtn = document.querySelector('#copyAnswerBtn');
const clearPromptBtn = document.querySelector('#clearPromptBtn');
const promptInput = document.querySelector('#prompt');
const modelSelect = document.querySelector('#model');
const fallbackModelSelect = document.querySelector('#fallbackModel');
const maxTokensInput = document.querySelector('#maxTokens');
const temperatureInput = document.querySelector('#temperature');
const loadHistoryBtn = document.querySelector('#loadHistoryBtn');
const historyLimitInput = document.querySelector('#historyLimit');
const historyBox = document.querySelector('#historyBox');
const templateBox = document.querySelector('#templateBox');

const storageKey = 'opeclaw.gatewayBase';
const defaultGateway = 'https://api.yjs.de5.net';
const templates = [
  {
    title: '总结提炼',
    prompt: '请用中文提炼下面内容的核心观点，输出 3 条要点和 1 条结论：\n\n'
  },
  {
    title: '改写润色',
    prompt: '请把下面这段话改写得更自然、更有条理，但不要改变原意：\n\n'
  },
  {
    title: '短文案',
    prompt: '请基于下面信息，写 3 条简短中文文案，每条不超过 30 字：\n\n'
  },
  {
    title: '代码解释',
    prompt: '请用中文解释下面代码的作用、输入输出和关键逻辑：\n\n'
  },
  {
    title: '排查思路',
    prompt: '请根据下面问题给出直接可执行的排查步骤和修复建议：\n\n'
  },
  {
    title: '结构化提问',
    prompt: '请把下面需求整理成更清晰的执行清单、关键风险和下一步动作：\n\n'
  }
];

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

function renderTemplates() {
  templateBox.innerHTML = templates.map((item, index) => `
    <button class="template-card" data-template-index="${index}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.prompt.slice(0, 30))}...</span>
    </button>
  `).join('');

  templateBox.querySelectorAll('[data-template-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const template = templates[Number(button.dataset.templateIndex)];
      promptInput.value = template.prompt;
      promptInput.focus();
    });
  });
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
        <div class="history-buttons">
          <button class="secondary small" data-rerun='${JSON.stringify({ prompt: item.prompt, model: item.final_model }).replaceAll("'", '&#39;')}'>一键重跑</button>
          <button class="secondary small" data-reuse-prompt='${escapeHtml(item.prompt)}'>载入 Prompt</button>
        </div>
      </article>
    `).join('');

    historyBox.querySelectorAll('[data-rerun]').forEach((button) => {
      button.addEventListener('click', async () => {
        const payload = JSON.parse(button.getAttribute('data-rerun'));
        promptInput.value = payload.prompt;
        modelSelect.value = payload.model;
        await runPrompt();
      });
    });

    historyBox.querySelectorAll('[data-reuse-prompt]').forEach((button) => {
      button.addEventListener('click', () => {
        promptInput.value = button.getAttribute('data-reuse-prompt');
        promptInput.focus();
      });
    });
  } catch (error) {
    historyBox.textContent = `加载失败：${error.message}`;
  }
}

async function runPrompt() {
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

runBtn.addEventListener('click', runPrompt);
loadHistoryBtn.addEventListener('click', loadHistory);
copyAnswerBtn.addEventListener('click', async () => {
  const text = answerBox.textContent.trim();
  if (!text || text === '等待执行...' || text === '执行中...') return;
  await navigator.clipboard.writeText(text);
  metaTag.textContent = '回答已复制';
  metaTag.className = 'meta-tag ok';
});
clearPromptBtn.addEventListener('click', () => {
  promptInput.value = '';
  promptInput.focus();
});

renderTemplates();
loadHistory();
