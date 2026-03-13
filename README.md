# opeclaw-workers

OpenClaw / Cloudflare / Hugging Face / GitHub 联动实验仓库。

## 这个仓库是干什么的

这个仓库的目标不是只放一个 Worker，而是逐步搭出一套完整的 **AI 实验与发布底座**：

- **GitHub**：代码、版本、自动化、文档
- **Cloudflare**：Worker、Pages、域名、边缘运行
- **Hugging Face**：模型、推理、实验能力
- **OpenClaw**：后续接入自动执行与调度能力

## 当前目录结构

```text
.
├── apps
│   ├── web              # 前端实验页
│   └── worker           # Cloudflare Worker 统一网关
├── docs
│   ├── ARCHITECTURE.md  # 架构设计
│   └── DEPLOY.md        # 部署说明
├── scripts              # 自检脚本
├── wrangler.toml        # Worker 配置
└── .github/workflows    # GitHub Actions
```

## 当前已实现内容

### Worker 网关
默认通过 Hugging Face Router 调用模型，当前默认模型：`Qwen/Qwen2.5-72B-Instruct`。

提供这些接口：

- `GET /health`
- `GET /api/whoami`
- `GET /api/providers`
- `POST /api/chat`
- `GET /api/experiments`

### 前端实验页
提供一个最小实验台，用来：

- 查看网关连通状态
- 切换多个模型
- 自定义网关地址
- 发送 prompt 到 Worker
- 验证 Hugging Face 推理链路

## 计划路线

### 第一阶段：打通三端
- [x] GitHub 仓库初始化
- [x] Worker 网关骨架
- [x] 前端实验页骨架
- [x] 中文架构与部署文档
- [x] 接入 Cloudflare secrets
- [x] 配置正式域名（api.yjs.de5.net）
- [x] 打通 Hugging Face 推理链路基础接口

### 第二阶段：做成可持续扩展平台
- [x] D1 实验记录存储
- [x] 前端多模型切换实验页
- [x] 前端历史记录面板
- [ ] 请求日志与实验记录
- [ ] R2 / KV / D1 接入
- [ ] GitHub Actions 自动部署
- [ ] Pages 正式站点

## 本地启动

### 安装依赖

```bash
npm install
```

### 本地跑 Worker

```bash
npm run dev:worker
```

### 打开前端实验页

直接打开：

```text
apps/web/index.html
```

## 凭据说明

敏感信息不要提交到仓库。
使用：

```bash
wrangler secret put HF_TOKEN
wrangler secret put GITHUB_TOKEN
```

## 后续方向

这个仓库后面会继续扩成：

- 统一 AI API 网关
- 个人实验控制台
- 自动化内容处理流水线
- OpenClaw 可调用的能力底座


## 当前在线入口

- 前端：`https://lab.yjs.de5.net`
- API：`https://api.yjs.de5.net`
