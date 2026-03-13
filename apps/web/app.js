const gatewayInput = document.querySelector('#gatewayBase');
const saveGatewayBtn = document.querySelector('#saveGatewayBtn');
const gatewayInfoBox = document.querySelector('#gatewayInfoBox');
const statusBox = document.querySelector('#statusBox');
const assetNameInput = document.querySelector('#assetName');
const assetSearchInput = document.querySelector('#assetSearch');
const assetSourceFilter = document.querySelector('#assetSourceFilter');
const assetsBox = document.querySelector('#assetsBox');
const assetDetailBox = document.querySelector('#assetDetailBox');
const saveAnswerAssetBtn = document.querySelector('#saveAnswerAssetBtn');
const loadAssetsBtn = document.querySelector('#loadAssetsBtn');
const resultBox = document.querySelector('#resultBox');
const answerBox = document.querySelector('#answerBox');
const resultSummaryBox = document.querySelector('#resultSummaryBox');
const metaTag = document.querySelector('#metaTag');
const checkBtn = document.querySelector('#checkBtn');
const loadDashboardBtn = document.querySelector('#loadDashboardBtn');
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
const historySearchInput = document.querySelector('#historySearch');
const historyTagFilter = document.querySelector('#historyTagFilter');
const historyFallbackFilter = document.querySelector('#historyFallbackFilter');
const historyBox = document.querySelector('#historyBox');
const templateBox = document.querySelector('#templateBox');
const templateSearchInput = document.querySelector('#templateSearch');
const templateCategoryFilter = document.querySelector('#templateCategoryFilter');
const templateFavoriteFilter = document.querySelector('#templateFavoriteFilter');
const dashboardBox = document.querySelector('#dashboardBox');

const storageKey = 'opeclaw.gatewayBase';
const defaultGateway = 'https://api.yjs.de5.net';
const builtinTemplates = [
  { title: '总结提炼', prompt: '请用中文提炼下面内容的核心观点，输出 3 条要点和 1 条结论：\n\n', category: '分析' },
  { title: '改写润色', prompt: '请把下面这段话改写得更自然、更有条理，但不要改变原意：\n\n', category: '写作' },
  { title: '短文案', prompt: '请基于下面信息，写 3 条简短中文文案，每条不超过 30 字：\n\n', category: '运营' },
  { title: '代码解释', prompt: '请用中文解释下面代码的作用、输入输出和关键逻辑：\n\n', category: '代码' },
  { title: '排查思路', prompt: '请根据下面问题给出直接可执行的排查步骤和修复建议：\n\n', category: '排障' },
  { title: '结构化提问', prompt: '请把下面需求整理成更清晰的执行清单、关键风险和下一步动作：\n\n', category: '分析' }
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

function renderResultSummary(data = {}) {
  const answer = (data.answer || '').trim();
  const fallback = data.fallbackUsed ? '发生回退' : '主模型直出';
  const model = data.model || 'unknown';
  const primary = data.primaryModel || model;
  resultSummaryBox.innerHTML = `
    <article class="result-card">
      <div class="result-grid">
        <div><span class="history-label">最终模型</span><div>${escapeHtml(model)}</div></div>
        <div><span class="history-label">请求模型</span><div>${escapeHtml(primary)}</div></div>
        <div><span class="history-label">输出状态</span><div>${escapeHtml(fallback)}</div></div>
        <div><span class="history-label">回答长度</span><div>${escapeHtml(answer.length)}</div></div>
      </div>
    </article>
  `;
}

async function archiveHistoryItemAsAsset(payload) {
  const name = `history-${payload.id || 'item'}-${Date.now()}`;
  const content = [
    `时间: ${payload.created_at || ''}`,
    `请求模型: ${payload.requested_model || ''}`,
    `最终模型: ${payload.final_model || ''}`,
    `是否回退: ${payload.fallback_used ? '是' : '否'}`,
    '',
    'Prompt:',
    payload.prompt || '',
    '',
    'Answer:',
    payload.answer || ''
  ].join('\n');
  await request('/api/assets/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content, source: 'history-archive' })
  });
  metaTag.textContent = '历史记录已归档到资产区';
  metaTag.className = 'meta-tag ok';
  await loadAssets();
}

async function showAssetDetail(id) {
  assetDetailBox.textContent = '加载详情中...';
  try {
    const result = await request(`/api/assets/${id}`);
    const item = result.data?.item;
    if (!item) {
      assetDetailBox.textContent = '资产不存在';
      return;
    }
    assetDetailBox.innerHTML = `
      <article class="result-card">
        <div class="history-item-head">
          <span class="history-id">#${escapeHtml(item.id)}</span>
          <span class="history-time">${escapeHtml(item.created_at || '')}</span>
        </div>
        <div class="history-models">
          <span>名称：${escapeHtml(item.name || '')}</span>
          <span>来源：${escapeHtml(item.source || '')}</span>
        </div>
        <div class="history-block"><div class="history-label">内容</div><div class="history-text">${escapeHtml(item.content || '')}</div></div>
        <div class="history-buttons">
          <button class="secondary small" id="copyAssetBtn">复制内容</button>
          <button class="secondary small" id="reuseAssetBtn">投喂给模型</button>
        </div>
      </article>
    `;
    document.querySelector('#copyAssetBtn')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(item.content || '');
      metaTag.textContent = '资产内容已复制';
      metaTag.className = 'meta-tag ok';
    });
    document.querySelector('#reuseAssetBtn')?.addEventListener('click', () => {
      promptInput.value = item.content || '';
      promptInput.focus();
      metaTag.textContent = '资产内容已载入输入框';
      metaTag.className = 'meta-tag ok';
    });
  } catch (error) {
    assetDetailBox.textContent = `加载失败：${error.message}`;
  }
}

async function loadAssets() {
  assetsBox.textContent = '加载中...';
  try {
    const q = encodeURIComponent(assetSearchInput.value.trim());
    const source = encodeURIComponent(assetSourceFilter.value);
    const result = await request(`/api/assets?limit=20&q=${q}&source=${source}`);
    const items = result.data?.items || [];
    if (!items.length) {
      assetsBox.textContent = '暂无资产';
      return;
    }
    assetsBox.innerHTML = items.map((item) => `
      <article class="history-item">
        <div class="history-item-head">
          <span class="history-id">#${escapeHtml(item.id)}</span>
          <span class="history-time">${escapeHtml(item.created_at || '')}</span>
        </div>
        <div class="history-models">
          <span>名称：${escapeHtml(item.name || '')}</span>
          <span>来源：${escapeHtml(item.source || '')}</span>
        </div>
        <div class="history-block"><div class="history-label">内容预览</div><div class="history-text">${escapeHtml((item.content || '').slice(0, 160))}</div></div>
        <div class="history-buttons">
          <button class="secondary small" data-open-asset="${escapeHtml(item.id)}">查看详情</button>
          <button class="secondary small" data-use-asset-content="${escapeHtml(item.content || '')}">投喂模型</button>
        </div>
      </article>
    `).join('');
    assetsBox.querySelectorAll('[data-open-asset]').forEach((button) => {
      button.addEventListener('click', async () => {
        await showAssetDetail(button.getAttribute('data-open-asset'));
      });
    });
    assetsBox.querySelectorAll('[data-use-asset-content]').forEach((button) => {
      button.addEventListener('click', () => {
        promptInput.value = button.getAttribute('data-use-asset-content');
        promptInput.focus();
        metaTag.textContent = '资产内容已载入输入框';
        metaTag.className = 'meta-tag ok';
      });
    });
  } catch (error) {
    assetsBox.textContent = `加载失败：${error.message}`;
  }
}

async function saveCurrentAnswerAsAsset() {
  const content = answerBox.textContent.trim();
  if (!content || content === '等待执行...' || content === '执行中...') return;
  const name = assetNameInput.value.trim() || 'answer';
  await request('/api/assets/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content, source: 'answer-box' })
  });
  metaTag.textContent = '回答已保存到资产区';
  metaTag.className = 'meta-tag ok';
  await loadAssets();
}

async function loadDashboard() {
  dashboardBox.textContent = '加载中...';
  try {
    const result = await request('/api/dashboard');
    const data = result.data || {};
    dashboardBox.innerHTML = `
      <article class="dashboard-card">
        <h3>Cloudflare</h3>
        <div>前端：${escapeHtml(data.cloudflare?.web || '')}</div>
        <div>网关：${escapeHtml(data.cloudflare?.gateway || '')}</div>
        <div>D1：${data.cloudflare?.d1 ? '已连接' : '未连接'}</div>
      </article>
      <article class="dashboard-card">
        <h3>GitHub</h3>
        <div>可用：${data.github?.enabled ? '是' : '否'}</div>
        <div>账号：${escapeHtml(data.github?.login || '')}</div>
        <div>名称：${escapeHtml(data.github?.name || '')}</div>
        <div>公开仓库：${escapeHtml(data.github?.public_repos ?? '')}</div>
      </article>
      <article class="dashboard-card">
        <h3>Hugging Face</h3>
        <div>可用：${data.huggingface?.enabled ? '是' : '否'}</div>
        <div>账号：${escapeHtml(data.huggingface?.name || '')}</div>
        <div>类型：${escapeHtml(data.huggingface?.type || '')}</div>
        <div>默认模型：${escapeHtml(data.huggingface?.defaultModel || '')}</div>
        <div>回退模型：${escapeHtml(data.huggingface?.fallbackModel || '')}</div>
      </article>
      <article class="dashboard-card">
        <h3>存储</h3>
        <div>实验记录：${escapeHtml(data.storage?.experiments ?? '')}</div>
        <div>自定义模板：${escapeHtml(data.storage?.templates ?? '')}</div>
        <div>文本资产：${escapeHtml(data.storage?.assets ?? '')}</div>
      </article>
    `;
  } catch (error) {
    dashboardBox.textContent = `加载失败：${error.message}`;
  }
}

async function loadTemplates() {
  templateBox.innerHTML = `
    <div class="template-manage">
      <input id="customTemplateTitle" placeholder="自定义模板标题" />
      <input id="customTemplateCategory" placeholder="分类，例如：写作/代码/运营" />
      <label class="checkbox-line"><input id="customTemplateFavorite" type="checkbox" /> 收藏</label>
      <textarea id="customTemplateContent" placeholder="自定义模板内容"></textarea>
      <button id="saveTemplateBtn">保存自定义模板</button>
    </div>
  `;

  const builtinHtml = builtinTemplates.map((item, index) => `
    <button class="template-card" data-template-type="builtin" data-template-index="${index}">
      <strong>${escapeHtml(item.title)}</strong>
      <span class="template-meta">分类：${escapeHtml(item.category)}</span>
      <span>${escapeHtml(item.prompt.slice(0, 30))}...</span>
    </button>
  `).join('');

  let customHtml = '';
  try {
    const q = encodeURIComponent(templateSearchInput.value.trim());
    const category = encodeURIComponent(templateCategoryFilter.value);
    const favorite = encodeURIComponent(templateFavoriteFilter.value);
    const result = await request(`/api/templates?limit=50&q=${q}&category=${category}&favorite=${favorite}`);
    const items = result.data?.items || [];
    const allCategories = [...new Set(items.map((item) => item.category || '未分类'))];
    const currentCategory = templateCategoryFilter.value;
    templateCategoryFilter.innerHTML = '<option value="">全部分类</option>' + allCategories.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
    templateCategoryFilter.value = currentCategory || '';

    customHtml = items.map((item) => `
      <div class="template-card template-custom">
        <strong>${Number(item.is_favorite) === 1 ? '★ ' : ''}${escapeHtml(item.title)}</strong>
        <span class="template-meta">分类：${escapeHtml(item.category || '未分类')}</span>
        <span>${escapeHtml(item.content.slice(0, 40))}...</span>
        <div class="history-buttons">
          <button class="secondary small" data-template-type="custom" data-template-content="${escapeHtml(item.content)}">使用</button>
          <button class="secondary small" data-template-favorite-id="${item.id}" data-template-category="${escapeHtml(item.category || '未分类')}" data-template-next-favorite="${Number(item.is_favorite) === 1 ? 0 : 1}">${Number(item.is_favorite) === 1 ? '取消收藏' : '收藏'}</button>
          <button class="secondary small" data-edit-template='${JSON.stringify(item).replaceAll("'", '&#39;')}'>编辑</button>
          <button class="secondary small" data-delete-template="${item.id}">删除</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    customHtml = `<div class="template-card template-custom"><span>自定义模板加载失败：${escapeHtml(error.message)}</span></div>`;
  }

  templateBox.innerHTML += builtinHtml + customHtml;

  templateBox.querySelectorAll('[data-template-type="builtin"]').forEach((button) => {
    button.addEventListener('click', () => {
      const template = builtinTemplates[Number(button.dataset.templateIndex)];
      promptInput.value = template.prompt;
      promptInput.focus();
    });
  });

  templateBox.querySelectorAll('[data-template-type="custom"]').forEach((button) => {
    button.addEventListener('click', () => {
      promptInput.value = button.getAttribute('data-template-content');
      promptInput.focus();
    });
  });

  templateBox.querySelectorAll('[data-delete-template]').forEach((button) => {
    button.addEventListener('click', async () => {
      await request(`/api/templates/${button.getAttribute('data-delete-template')}`, { method: 'DELETE' });
      await loadTemplates();
    });
  });

  templateBox.querySelectorAll('[data-edit-template]').forEach((button) => {
    button.addEventListener('click', async () => {
      const item = JSON.parse(button.getAttribute('data-edit-template'));
      const title = window.prompt('模板标题', item.title || '');
      if (title === null) return;
      const category = window.prompt('模板分类', item.category || '未分类');
      if (category === null) return;
      const content = window.prompt('模板内容', item.content || '');
      if (content === null) return;
      await request(`/api/templates/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          category,
          is_favorite: Number(item.is_favorite) === 1
        })
      });
      await loadTemplates();
    });
  });

  templateBox.querySelectorAll('[data-template-favorite-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await request(`/api/templates/${button.getAttribute('data-template-favorite-id')}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: button.getAttribute('data-template-category') || '未分类',
          is_favorite: Number(button.getAttribute('data-template-next-favorite')) === 1
        })
      });
      await loadTemplates();
    });
  });

  document.querySelector('#saveTemplateBtn')?.addEventListener('click', async () => {
    const title = document.querySelector('#customTemplateTitle')?.value?.trim();
    const category = document.querySelector('#customTemplateCategory')?.value?.trim() || '未分类';
    const isFavorite = Boolean(document.querySelector('#customTemplateFavorite')?.checked);
    const content = document.querySelector('#customTemplateContent')?.value?.trim();
    if (!title || !content) return;
    await request('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, category, is_favorite: isFavorite })
    });
    await loadTemplates();
  });
}

async function loadHistory() {
  historyBox.textContent = '加载中...';
  try {
    const limit = Number(historyLimitInput.value || 10);
    const q = encodeURIComponent(historySearchInput.value.trim());
    const tag = encodeURIComponent(historyTagFilter.value);
    const fallback = encodeURIComponent(historyFallbackFilter.value);
    const result = await request(`/api/experiments?limit=${limit}&q=${q}&tag=${tag}&fallback=${fallback}`);
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
          <span class="badge">标签：${escapeHtml(item.tag || '未分类')}</span>
          <span class="badge ${item.fallback_used ? 'warn' : 'ok'}">${item.fallback_used ? '发生回退' : '未回退'}</span>
        </div>
        <div class="history-block"><div class="history-label">Prompt</div><div class="history-text">${escapeHtml(item.prompt)}</div></div>
        <div class="history-block"><div class="history-label">Answer</div><div class="history-text">${escapeHtml(item.answer || '')}</div></div>
        <div class="history-buttons">
          <button class="secondary small" data-rerun='${JSON.stringify({ prompt: item.prompt, model: item.final_model }).replaceAll("'", '&#39;')}'>一键重跑</button>
          <button class="secondary small" data-reuse-prompt='${escapeHtml(item.prompt)}'>载入 Prompt</button>
          <button class="secondary small" data-archive-history='${JSON.stringify(item).replaceAll("'", '&#39;')}'>归档到资产区</button>
          <button class="secondary small" data-tag-history='${JSON.stringify({ id: item.id, tag: item.tag || '未分类' }).replaceAll("'", '&#39;')}'>改标签</button>
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

    historyBox.querySelectorAll('[data-archive-history]').forEach((button) => {
      button.addEventListener('click', async () => {
        const payload = JSON.parse(button.getAttribute('data-archive-history'));
        await archiveHistoryItemAsAsset(payload);
      });
    });

    historyBox.querySelectorAll('[data-tag-history]').forEach((button) => {
      button.addEventListener('click', async () => {
        const payload = JSON.parse(button.getAttribute('data-tag-history'));
        const nextTag = window.prompt('实验标签', payload.tag || '未分类');
        if (nextTag === null) return;
        await request(`/api/experiments/${payload.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: nextTag })
        });
        await loadHistory();
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
    resultSummaryBox.textContent = '先输入 prompt';
    resultBox.textContent = '先输入 prompt';
    metaTag.textContent = '缺少输入';
    metaTag.className = 'meta-tag warn';
    return;
  }
  answerBox.textContent = '执行中...';
  resultSummaryBox.textContent = '执行中...';
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
    renderResultSummary(data);
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
    resultSummaryBox.textContent = `调用失败：${error.message}`;
    resultBox.textContent = `调用失败：${error.message}`;
    metaTag.textContent = '请求失败';
    metaTag.className = 'meta-tag danger';
  }
}

saveGatewayBtn.addEventListener('click', () => {
  localStorage.setItem(storageKey, getGatewayBase());
  gatewayInfoBox.textContent = `当前网关：${getGatewayBase()}`;
});
loadDashboardBtn.addEventListener('click', loadDashboard);
checkBtn.addEventListener('click', async () => {
  statusBox.textContent = '检查中...';
  try {
    const [health, whoami, providers] = await Promise.all([request('/health'), request('/api/whoami'), request('/api/providers')]);
    statusBox.textContent = JSON.stringify({ health, whoami, providers }, null, 2);
  } catch (error) {
    statusBox.textContent = `检查失败: ${error.message}`;
  }
});
runBtn.addEventListener('click', runPrompt);
loadHistoryBtn.addEventListener('click', loadHistory);
historySearchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadHistory(); });
historyTagFilter.addEventListener('change', loadHistory);
historyFallbackFilter.addEventListener('change', loadHistory);
loadAssetsBtn.addEventListener('click', loadAssets);
saveAnswerAssetBtn.addEventListener('click', saveCurrentAnswerAsAsset);
assetSearchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadAssets(); });
assetSourceFilter.addEventListener('change', loadAssets);
templateSearchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadTemplates(); });
templateCategoryFilter.addEventListener('change', loadTemplates);
templateFavoriteFilter.addEventListener('change', loadTemplates);
copyAnswerBtn.addEventListener('click', async () => {
  const text = answerBox.textContent.trim();
  if (!text || text === '等待执行...' || text === '执行中...') return;
  await navigator.clipboard.writeText(text);
  metaTag.textContent = '回答已复制';
  metaTag.className = 'meta-tag ok';
});
clearPromptBtn.addEventListener('click', () => { promptInput.value = ''; promptInput.focus(); });

loadDashboard();
loadTemplates();
loadHistory();
loadAssets();
