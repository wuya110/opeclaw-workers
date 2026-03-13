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

async function saveExperiment(env, payload) {
  if (!env.DB) return;

  await env.DB.prepare(`
    INSERT INTO experiments (
      created_at,
      prompt,
      requested_model,
      final_model,
      fallback_used,
      answer,
      raw_result
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      new Date().toISOString(),
      payload.prompt,
      payload.requestedModel,
      payload.finalModel,
      payload.fallbackUsed ? 1 : 0,
      payload.answer,
      JSON.stringify(payload.rawResult)
    )
    .run();
}

async function listTemplates(env, limit = 50) {
  if (!env.DB) return [];

  const result = await env.DB.prepare(`
    SELECT id, created_at, title, content
    FROM prompt_templates
    ORDER BY id DESC
    LIMIT ?
  `).bind(limit).all();

  return result.results || [];
}

async function saveTemplate(env, title, content) {
  if (!env.DB) return null;

  const result = await env.DB.prepare(`
    INSERT INTO prompt_templates (created_at, title, content)
    VALUES (?, ?, ?)
  `).bind(new Date().toISOString(), title, content).run();

  return result.meta?.last_row_id || null;
}

async function deleteTemplate(env, id) {
  if (!env.DB) return;
  await env.DB.prepare('DELETE FROM prompt_templates WHERE id = ?').bind(id).run();
}

async function listExperiments(env, limit = 20) {
  if (!env.DB) return [];

  const result = await env.DB.prepare(`
    SELECT id, created_at, prompt, requested_model, final_model, fallback_used, answer
    FROM experiments
    ORDER BY id DESC
    LIMIT ?
  `).bind(limit).all();

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
        const rows = await listExperiments(env, Number(url.searchParams.get('limit') || 20));
        return json({ ok: true, items: rows }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/templates' && request.method === 'GET') {
        const rows = await listTemplates(env, Number(url.searchParams.get('limit') || 50));
        return json({ ok: true, items: rows }, 200, corsHeaders(origin));
      }

      if (url.pathname === '/api/templates' && request.method === 'POST') {
        const body = await request.json();
        const title = String(body?.title || '').trim();
        const content = String(body?.content || '').trim();
        if (!title || !content) {
          return json({ ok: false, error: 'title 和 content 不能为空' }, 400, corsHeaders(origin));
        }
        const id = await saveTemplate(env, title, content);
        return json({ ok: true, id }, 200, corsHeaders(origin));
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
