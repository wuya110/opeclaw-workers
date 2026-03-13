# 部署说明

## 1. 本地安装依赖

```bash
npm install
```

## 2. 登录 Cloudflare

```bash
wrangler login
```

或通过环境变量注入已有凭据。

## 3. 配置 Worker Secrets

```bash
wrangler secret put HF_TOKEN
wrangler secret put GITHUB_TOKEN
```

## 4. 本地调试 Worker

```bash
npm run dev:worker
```

## 5. 部署到 Cloudflare

```bash
npm run deploy:worker
```

## 6. 前端本地预览

可以直接打开：

- `apps/web/index.html`

默认会请求本地 `http://127.0.0.1:8787` 的 Worker。
