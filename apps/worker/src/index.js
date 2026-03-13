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
    gateway: 'api.yjs.de5.net'
  }, 200, corsHeaders(origin));
}

async function handleProviders(env, origin) {
  return json({
    ok: true,
    providers: {
      cloudflare: {
        enabled: true,
        entrypoint: 'https://api.yjs.de5.net',
        role: '公网入口、路由、鉴权、限流、边缘执行'
      },
      huggingface: {
        enabled: Boolean(env.HF_TOKEN),
        defaultModel: env.HF_MODEL,
        role: '模型推理与实验能力'
      },
      github: {
        enabled: Boolean(env.GITHUB_TOKEN),
        role: '代码、版本、自动化与配置追踪'
      }
    }
  }, 200, corsHeaders(origin));
}

async function handleChat(request, env, origin) {
  if (!env.HF_TOKEN) {
    return json({
      ok: false,
      error: 'HF_TOKEN 未配置'
    }, 500, corsHeaders(origin));
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

  const model = String(body?.model || env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct');
  const payload = {
    inputs: prompt,
    parameters: {
      max_new_tokens: Number(body?.max_new_tokens || 256),
      return_full_text: false,
      temperature: Number(body?.temperature || 0.7)
    }
  };

  const upstream = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const raw = await upstream.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  return json({
    ok: upstream.ok,
    model,
    result: parsed
  }, upstream.ok ? 200 : upstream.status, corsHeaders(origin));
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

      return json({ ok: false, error: '路由不存在' }, 404, corsHeaders(origin));
    } catch (error) {
      return json({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }, 500, corsHeaders(origin));
    }
  }
};
