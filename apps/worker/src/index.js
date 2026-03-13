const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers
    }
  });

function corsHeaders(origin = '*') {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization'
  };
}

async function handleWhoAmI(env, origin) {
  return json({
    ok: true,
    app: env.APP_NAME,
    authReady: {
      huggingface: Boolean(env.HF_TOKEN),
      github: Boolean(env.GITHUB_TOKEN)
    },
    gateway: 'api.yjs.de5.net',
    defaultModel: env.HF_MODEL,
    fallbackModel: env.HF_FALLBACK_MODEL || 'meta-llama/Llama-3.3-70B-Instruct'
  }, 200, corsHeaders(origin));
}

async function handleProviders(env, origin) {
  return json({
    ok: true,
    providers: {
      cloudflare: {
        enabled: true,
        entrypoint: 'https://api.yjs.de5.net',
        web: 'https://lab.yjs.de5.net',
        d1: Boolean(env.DB),
        templates: Boolean(env.DB),
        role: '公网入口、路由、鉴权、限流、边缘执行'
      },
      huggingface: {
        enabled: Boolean(env.HF_TOKEN),
        defaultModel: env.HF_MODEL,
        fallbackModel: env.HF_FALLBACK_MODEL || 'meta-llama/Llama-3.3-70B-Instruct',
        role: '模型推理与实验能力'
      },
      github: {
        enabled: Boolean(env.GITHUB_TOKEN),
        role: '代码、版本、自动化与配置追踪'
      }
    }
  }, 200, corsHeaders(origin));
}

function detectExperimentTag(prompt = '') {
  const text = String(prompt).toLowerCase();
  if (/代码|code|bug|报错|异常|脚本|接口|api|debug/.test(text)) return '代码';
  if (/文案|标题|卖点|运营|推广|广告/.test(text)) return '运营';
  if (/总结|分析|整理|提炼|结构化|归纳/.test(text)) return '分析';
  if (/改写|润色|写作|文章|小红书|公众号/.test(text)) return '写作';
  if (/排查|故障|修复|定位/.test(text)) return '排障';
  return '未分类';
}

async function saveExperiment(env, payload) {
  if (!env.DB) return;

  const tag = payload.tag || detectExperimentTag(payload.prompt);

  await env.DB.prepare(`
    INSERT INTO experiments (
      created_at,
      prompt,
      requested_model,
      final_model,
      fallback_used,
      answer,
      raw_result,
      tag
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      new Date().toISOString(),
      payload.prompt,
      payload.requestedModel,
      payload.finalModel,
      payload.fallbackUsed ? 1 : 0,
      payload.answer,
      JSON.stringify(payload.rawResult),
      tag
    )
    .run();
}

async function listTemplates(env, limit = 50) {
  if (!env.DB) return [];

  const result = await env.DB.prepare(`
    SELECT id, created_at, title, content, COALESCE(category, '未分类') AS category, COALESCE(is_favorite, 0) AS is_favorite
    FROM prompt_templates
    ORDER BY is_favorite DESC, id DESC
    LIMIT ?
  `).bind(limit).all();

  return result.results || [];
}

async function saveTemplate(env, title, content, category = '未分类', isFavorite = false) {
  if (!env.DB) return null;

  const result = await env.DB.prepare(`
    INSERT INTO prompt_templates (created_at, title, content, category, is_favorite)
    VALUES (?, ?, ?, ?, ?)
  `).bind(new Date().toISOString(), title, content, category, isFavorite ? 1 : 0).run();

  return result.meta?.last_row_id || null;
}

async function updateTemplateMeta(env, id, category, isFavorite) {
  if (!env.DB) return;
  await env.DB.prepare(`
    UPDATE prompt_templates
    SET category = ?, is_favorite = ?
    WHERE id = ?
  `).bind(category, isFavorite ? 1 : 0, id).run();
}

async function deleteTemplate(env, id) {
  if (!env.DB) return;
  await env.DB.prepare('DELETE FROM prompt_templates WHERE id = ?').bind(id).run();
}

async function updateExperimentTag(env, id, tag) {
  if (!env.DB) return;
  await env.DB.prepare('UPDATE experiments SET tag = ? WHERE id = ?').bind(tag, id).run();
}

async function listTextAssets(env, options = {}) {
  if (!env.DB) return [];
  const limit = Number(options.limit || 20);
  const q = String(options.q || '').trim();
  const source = String(options.source || '').trim();

  let sql = `
    SELECT id, created_at, name, content, source
    FROM text_assets
    WHERE 1 = 1
  `;
  const binds = [];

  if (q) {
    sql += ' AND (name LIKE ? OR content LIKE ? OR source LIKE ?)';
    const like = `%${q}%`;
    binds.push(like, like, like);
  }

  if (source) {
    sql += ' AND source = ?';
    binds.push(source);
  }

  sql += ' ORDER BY id DESC LIMIT ?';
  binds.push(limit);

  const result = await env.DB.prepare(sql).bind(...binds).all();
  return result.results || [];
}

async function saveTextAsset(env, name, content, source = 'manual') {
  if (!env.DB) return null;
  const result = await env.DB.prepare(`
    INSERT INTO text_assets (created_at, name, content, source)
    VALUES (?, ?, ?, ?)
  `).bind(new Date().toISOString(), name, content, source).run();
  return result.meta?.last_row_id || null;
}

async function getTextAsset(env, id) {
  if (!env.DB) return null;
  return await env.DB.prepare(`
    SELECT id, created_at, name, content, source
    FROM text_assets
    WHERE id = ?
  `).bind(id).first();
}

async function updateTemplate(env, id, title, content, category, isFavorite) {
  if (!env.DB) return;
  await env.DB.prepare(`
    UPDATE prompt_templates
    SET title = ?, content = ?, category = ?, is_favorite = ?
    WHERE id = ?
  `).bind(title, content, category, isFavorite ? 1 : 0, id).run();
}

async function getDashboard(env) {
  const cloudflare = {
    gateway: 'https://api.yjs.de5.net',
    web: 'https://lab.yjs.de5.net',
    d1: Boolean(env.DB)
  };

  const githubToken = typeof env.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';
  let github = { enabled: false, source: githubToken ? 'token' : 'public-fallback' };
  if (githubToken) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'User-Agent': 'opeclaw-workers'
        }
      });
      const data = await response.json();
      if (response.ok) {
        github = {
          enabled: true,
          source: 'token',
          login: data.login || null,
          name: data.name || null,
          public_repos: data.public_repos ?? null
        };
      } else {
        github = {
          enabled: false,
          source: 'token',
          auth_error: data.message || 'GitHub token unavailable'
        };
      }
    } catch (error) {
      github = { enabled: false, source: 'token', error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (!github.enabled) {
    try {
      const response = await fetch('https://api.github.com/users/wuya110', {
        headers: { 'User-Agent': 'opeclaw-workers' }
      });
      const data = await response.json();
      if (response.ok) {
        github = {
          enabled: true,
          source: github.source === 'token' ? 'public-fallback-after-token-failure' : 'public-fallback',
          login: data.login || 'wuya110',
          name: data.name || null,
          public_repos: data.public_repos ?? null,
          profile: data.html_url || null
        };
      }
    } catch (error) {
      github.error = error instanceof Error ? error.message : String(error);
    }
  }

  let huggingface = { enabled: Boolean(env.HF_TOKEN), defaultModel: env.HF_MODEL };
  if (env.HF_TOKEN) {
    try {
      const response = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { Authorization: `Bearer ${env.HF_TOKEN}` }
      });
      const data = await response.json();
      huggingface = {
        enabled: response.ok,
        name: data.name || null,
        fullname: data.fullname || null,
        type: data.type || null,
        defaultModel: env.HF_MODEL,
        fallbackModel: env.HF_FALLBACK_MODEL || null
      };
    } catch (error) {
      huggingface = { enabled: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  let counts = { experiments: null, templates: null, assets: null };
  if (env.DB) {
    try {
      const exp = await env.DB.prepare('SELECT COUNT(*) AS count FROM experiments').first();
      const tpl = await env.DB.prepare('SELECT COUNT(*) AS count FROM prompt_templates').first();
      const ast = await env.DB.prepare('SELECT COUNT(*) AS count FROM text_assets').first();
      counts = {
        experiments: Number(exp?.count || 0),
        templates: Number(tpl?.count || 0),
        assets: Number(ast?.count || 0)
      };
    } catch (error) {
      counts = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  return {
    ok: true,
    cloudflare,
    github,
    huggingface,
    storage: counts
  };
}

async function listExperiments(env, options = {}) {
  if (!env.DB) return [];

  const limit = Number(options.limit || 20);
  const q = String(options.q || '').trim();
  const fallback = String(options.fallback || '').trim();
  const tag = String(options.tag || '').trim();

  let sql = `
    SELECT id, created_at, prompt, requested_model, final_model, fallback_used, answer, COALESCE(tag, '未分类') AS tag
    FROM experiments
    WHERE 1 = 1
  `;
  const binds = [];

  if (q) {
    sql += ' AND (prompt LIKE ? OR answer LIKE ? OR requested_model LIKE ? OR final_model LIKE ?)';
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }

  if (tag) {
    sql += ' AND tag = ?';
    binds.push(tag);
  }

  if (fallback === 'true') {
    sql += ' AND fallback_used = 1';
  } else if (fallback === 'false') {
    sql += ' AND fallback_used = 0';
  }

  sql += ' ORDER BY id DESC LIMIT ?';
  binds.push(limit);

  const result = await env.DB.prepare(sql).bind(...binds).all();
  return result.results || [];
}

async function callHfChat(env, model, prompt, maxTokens, temperature) {
  const upstream = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature
    })
  });

  const raw = await upstream.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  const answer = parsed && Array.isArray(parsed.choices) && parsed.choices[0]?.message
    ? (parsed.choices[0].message.content || '')
    : '';

  return { upstream, parsed, answer };
}

async function handleChat(request, env, origin) {
  if (!env.HF_TOKEN) {
    return json({ ok: false, error: 'HF_TOKEN 未配置' }, 500, corsHeaders(origin));
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: '请求体不是合法 JSON' }, 400, corsHeaders(origin));
  }

  const prompt = String(body?.prompt || '').trim();
  if (!prompt) {
    return json({ ok: false, error: 'prompt 不能为空' }, 400, corsHeaders(origin));
  }

  const model = String(body?.model || env.HF_MODEL || 'Qwen/Qwen2.5-72B-Instruct');
  const fallbackModel = String(body?.fallback_model || env.HF_FALLBACK_MODEL || 'meta-llama/Llama-3.3-70B-Instruct');
  const maxTokens = Number(body?.max_tokens || body?.max_new_tokens || 256);
  const temperature = Number(body?.temperature || 0.7);

  const primary = await callHfChat(env, model, prompt, maxTokens, temperature);
  const primaryOk = primary.upstream.ok && primary.answer.trim();

  if (primaryOk || model === fallbackModel) {
    await saveExperiment(env, {
      prompt,
      requestedModel: model,
      finalModel: model,
      fallbackUsed: false,
      answer: primary.answer,
      rawResult: primary.parsed
    });

    return json({
      ok: primary.upstream.ok,
      model,
      fallbackUsed: false,
      answer: primary.answer,
      result: primary.parsed
    }, primary.upstream.ok ? 200 : primary.upstream.status, corsHeaders(origin));
  }

  const fallback = await callHfChat(env, fallbackModel, prompt, maxTokens, temperature);
  await saveExperiment(env, {
    prompt,
    requestedModel: model,
    finalModel: fallbackModel,
    fallbackUsed: true,
    answer: fallback.answer,
    rawResult: {
      primary: primary.parsed,
      fallback: fallback.parsed
    }
  });

  return json({
    ok: fallback.upstream.ok,
    model: fallbackModel,
    fallbackUsed: true,
    primaryModel: model,
    answer: fallback.answer,
    primaryResult: primary.parsed,
    result: fallback.parsed
  }, fallback.upstream.ok ? 200 : fallback.upstream.status, corsHeaders(origin));
}

export default {
  async fetch(request, env) {
    const origin = env?.ALLOW_ORIGIN || '*';

    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }

      if (url.pathname === '/' || url.pathname === '/health') {
        return json({
          ok: true,
          service: 'opeclaw-workers-gateway',
          gateway: 'https://api.yjs.de5.net',
          web: 'https://lab.yjs.de5.net',
          time: new Date().toISOString()
        }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/whoami' && request.method === 'GET') {
        return handleWhoAmI(env, origin);
      }

      if (url.pathname === '/api/providers' && request.method === 'GET') {
        return handleProviders(env, origin);
      }

      if (url.pathname === '/api/chat' && request.method === 'POST') {
        return handleChat(request, env, origin);
      }

      if (url.pathname === '/api/experiments' && request.method === 'GET') {
        const rows = await listExperiments(env, {
          limit: Number(url.searchParams.get('limit') || 20),
          q: url.searchParams.get('q') || '',
          fallback: url.searchParams.get('fallback') || '',
          tag: url.searchParams.get('tag') || ''
        });
        return json({ ok: true, items: rows }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/templates' && request.method === 'GET') {
        let rows = await listTemplates(env, Number(url.searchParams.get('limit') || 50));
        const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
        const category = String(url.searchParams.get('category') || '').trim();
        const favorite = String(url.searchParams.get('favorite') || '').trim();
        if (q) {
          rows = rows.filter((item) => [item.title, item.content, item.category].some((v) => String(v || '').toLowerCase().includes(q)));
        }
        if (category) {
          rows = rows.filter((item) => String(item.category || '') === category);
        }
        if (favorite === 'true') {
          rows = rows.filter((item) => Number(item.is_favorite) === 1);
        }
        return json({ ok: true, items: rows }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/templates' && request.method === 'POST') {
        const body = await request.json();
        const title = String(body?.title || '').trim();
        const content = String(body?.content || '').trim();
        const category = String(body?.category || '未分类').trim() || '未分类';
        const isFavorite = Boolean(body?.is_favorite);
        if (!title || !content) {
          return json({ ok: false, error: 'title 和 content 不能为空' }, 400, corsHeaders(origin));
        }
        const id = await saveTemplate(env, title, content, category, isFavorite);
        return json({ ok: true, id }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/dashboard' && request.method === 'GET') {
        return json(await getDashboard(env), 200, corsHeaders(origin));
      }

      if (url.pathname.startsWith('/api/experiments/') && request.method === 'PATCH') {
        const id = Number(url.pathname.split('/').pop());
        if (!id) {
          return json({ ok: false, error: '无效实验 id' }, 400, corsHeaders(origin));
        }
        const body = await request.json();
        const tag = String(body?.tag || '未分类').trim() || '未分类';
        await updateExperimentTag(env, id, tag);
        return json({ ok: true }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/assets' && request.method === 'GET') {
        const rows = await listTextAssets(env, {
          limit: Number(url.searchParams.get('limit') || 20),
          q: url.searchParams.get('q') || '',
          source: url.searchParams.get('source') || ''
        });
        return json({ ok: true, items: rows }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/assets/text' && request.method === 'POST') {
        const body = await request.json();
        const name = String(body?.name || 'asset').trim();
        const content = String(body?.content || '').trim();
        const source = String(body?.source || 'manual').trim();
        if (!content) {
          return json({ ok: false, error: 'content 不能为空' }, 400, corsHeaders(origin));
        }
        const id = await saveTextAsset(env, name, content, source);
        return json({ ok: true, id }, 200, corsHeaders(origin));
      }

      if (url.pathname.startsWith('/api/assets/') && request.method === 'GET') {
        const id = Number(url.pathname.split('/').pop());
        if (!id) {
          return json({ ok: false, error: '无效资产 id' }, 400, corsHeaders(origin));
        }
        const item = await getTextAsset(env, id);
        if (!item) {
          return json({ ok: false, error: '资产不存在' }, 404, corsHeaders(origin));
        }
        return json({ ok: true, item }, 200, corsHeaders(origin));
      }

      if (url.pathname.startsWith('/api/templates/') && request.method === 'PATCH') {
        const id = Number(url.pathname.split('/').pop());
        if (!id) {
          return json({ ok: false, error: '无效模板 id' }, 400, corsHeaders(origin));
        }
        const body = await request.json();
        const category = String(body?.category || '未分类').trim() || '未分类';
        const isFavorite = Boolean(body?.is_favorite);
        const title = typeof body?.title === 'string' ? body.title.trim() : '';
        const content = typeof body?.content === 'string' ? body.content.trim() : '';
        if (title || content) {
          await updateTemplate(env, id, title || '未命名模板', content || '', category, isFavorite);
        } else {
          await updateTemplateMeta(env, id, category, isFavorite);
        }
        return json({ ok: true }, 200, corsHeaders(origin));
      }

      if (url.pathname.startsWith('/api/templates/') && request.method === 'DELETE') {
        const id = Number(url.pathname.split('/').pop());
        if (!id) {
          return json({ ok: false, error: '无效模板 id' }, 400, corsHeaders(origin));
        }
        await deleteTemplate(env, id);
        return json({ ok: true }, 200, corsHeaders(origin));
      }

      return json({ ok: false, error: '路由不存在' }, 404, corsHeaders(origin));
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, corsHeaders(origin));
    }
  }
};
