export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': env.ALLOW_ORIGIN || '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, route: url.pathname, app: env.APP_NAME || 'app' }), { status: 200, headers });
    }

    if (url.pathname === '/api/whoami') {
      return new Response(JSON.stringify({ ok: true, authReady: { huggingface: !!env.HF_TOKEN, github: !!env.GITHUB_TOKEN } }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404, headers });
  }
};
