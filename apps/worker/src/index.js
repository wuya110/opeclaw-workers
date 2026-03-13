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

async function handleWhoAmI(env) {
  const authReady = {
    huggingface: Boolean(env.HF_TOKEN),
    github: Boolean(env.GITHUB_TOKEN)
  };

  return json({
    ok: true,
    app: env.APP_NAME,
    authReady,
    message: '统一网关在线'
  }, 200, corsHeaders(env.ALLOW_ORIGIN));
}

async function handleProviders(env) {
  return json({
    ok: true,
    providers: {
      cloudflare: {
        enabled: true,
        role: '公网入口、路由、鉴权、限流、可观测性'
      },
      huggingface: {
        enabled: Boolean(env.HF_TOKEN),
        defaultModel: env.HF_MODEL,
        role: '开源模型推理与实验能力'
      },
      github: {
        enabled: Boolean(env.GITHUB_TOKEN),
        role: '代码、配置、自动化、版本追踪'
      }
    }
  }, 200, corsHeaders(env.ALLOW_ORIGIN));
}

async function handleChat(request, env) {
  const headers = corsHeaders(env.ALLOW_ORIGIN);

  if (!env.HF_TOKEN) {
    return json({
      ok: false,
      error: 'HF_TOKEN 未配置，暂时无法调用 Hugging Face 推理接口'
    }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: '请求体不是合法 JSON' }, 400, headers);
  }

  const prompt = String(body?.prompt || '').trim();
  if (!prompt) {
    return json({ ok: false, error: 'prompt 不能为空' }, 400, headers);
  }

  const model = body?.model || env.HF_MODEL;
  const response = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 256,
        return_full_text: false
      }
    })
  });

  const rawText = await response.text();
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = rawText;
  }

  return json({
    ok: response.ok,
    model,
    result: payload
  }, response.ok ? 200 : response.status, headers);
}

async function handleRequest(request, env) {
  const allowOrigin = env?.ALLOW_ORIGIN || '*';

  try {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        service: 'opeclaw-workers-gateway',
        time: new Date().toISOString(),
        version: 'v0.1.1'
      }, 200, corsHeaders(allowOrigin));
    }

    if (url.pathname === '/api/whoami' && request.method === 'GET') {
      return handleWhoAmI(env);
    }

    if (url.pathname === '/api/providers' && request.method === 'GET') {
      return handleProviders(env);
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    return json({ ok: false, error: '路由不存在' }, 404, corsHeaders(allowOrigin));
  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    }, 500, corsHeaders(allowOrigin));
  }
}

export default {
  fetch: handleRequest
};
