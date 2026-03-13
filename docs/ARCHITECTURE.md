# 架构设计总览

## 目标

把 **GitHub + Cloudflare + Hugging Face** 打通，形成一套可持续扩展的 AI 实验与发布底座。

## 角色分工

### 1. GitHub：代码与自动化中枢
负责：
- 仓库管理
- 版本控制
- CI / CD
- 配置追踪
- 文档沉淀

### 2. Cloudflare：对外入口与运行层
负责：
- Worker API 网关
- Pages 前端站点
- 域名接入
- KV / D1 / R2 扩展存储
- 鉴权、限流、缓存、边缘执行

### 3. Hugging Face：模型与实验能力层
负责：
- 开源模型调用
- 推理实验
- Spaces 原型
- 模型资产沉淀

## 推荐分层

### A. 展示层
- Cloudflare Pages
- 面向你自己的操作面板、实验台、轻量工具页面

### B. 接入层
- Cloudflare Worker
- 统一处理：
  - 路由
  - 鉴权
  - 日志
  - 限流
  - 多模型转发

### C. 能力层
- Hugging Face Inference
- 未来可扩展 OpenAI 兼容服务、Cloudflare AI、第三方 TTS / ASR

### D. 资产层
- GitHub：代码与文档
- R2：对象存储
- KV：轻状态缓存
- D1：结构化记录

## 第一阶段落地范围

### 已放入仓库的第一版骨架
- `apps/worker`：Worker 统一网关
- `apps/web`：前端实验页
- `docs/ARCHITECTURE.md`：总架构说明
- `wrangler.toml`：Cloudflare Worker 部署配置

### 当前 API
- `GET /health`
- `GET /api/whoami`
- `GET /api/providers`
- `POST /api/chat`

## 第二阶段计划

### 1. 接入真实 Cloudflare 资源
- Worker 正式部署
- Pages 站点部署
- 绑定域名
- 配置 secrets

### 2. 增加可观测性
- 请求日志
- 调用耗时
- 错误分类
- 使用量统计

### 3. 增加能力路由
- 文本模型
- Embedding
- 图像理解
- TTS / ASR
- 不同模型供应商切换

### 4. 增加业务能力
- Prompt 模板库
- 任务面板
- Webhook 触发器
- GitHub Issue -> Worker 自动处理

## 凭据治理原则

### GitHub
- 用于仓库、Actions、发布自动化
- 机密只放 GitHub Secrets 或 Cloudflare Secrets

### Cloudflare
- 用 wrangler secret 管理敏感项
- 不把 API Key 明文写入仓库

### Hugging Face
- 当前 token 已验证可用
- 后续建议旋转一次新 token
- Worker 内通过 `HF_TOKEN` secret 调用

## 后续最值得优先接的模块

1. **统一模型路由器**
   - 同一接口切换多个模型来源
2. **实验记录系统**
   - 记录输入、输出、模型、耗时
3. **任务自动化**
   - GitHub Actions + Worker Webhook
4. **对象存储与文件处理**
   - 用 R2 承接语音、图片、文档结果
