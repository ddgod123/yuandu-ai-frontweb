# Yuandu AI Frontweb

[中文](#中文简介) | [English](#english)

---

## 中文简介

元都AI（Yuandu AI）用户端应用。  
定位为「**视觉资产入口 + AI 创作工作台**」，用于浏览、创作、管理与下载视觉资产。

### 核心能力

- 视觉资产浏览（合集、单图、专题）
- 视频转视觉资产任务创建与结果管理
- 我的收藏 / 我的作品 / 下载管理
- 订阅、算力、次卡等权益页面

---

## English

User-facing web application for Yuandu AI.  
It serves as the **visual asset entry + AI creation workspace** for browsing, generating, organizing, and downloading assets.

### Core Capabilities

- Visual asset discovery (collections, single assets, themes)
- Video-to-asset task creation and result management
- Favorites, personal works, and download management
- Subscription, compute credits, and card-based entitlements

---

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

---

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default: `http://localhost:5918`

---

## Environment

```bash
NEXT_PUBLIC_API_BASE=/api
```

- Local direct backend: `http://localhost:5050/api`
- Production: recommended via Nginx reverse proxy on `/api`

---

## Build & Run

```bash
npm run build
npm run start
```

---

## Deployment

See: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

---

## License

See `LICENSE`.
