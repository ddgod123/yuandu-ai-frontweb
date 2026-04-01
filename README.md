# Yuandu AI Frontweb

[![Website](https://img.shields.io/badge/Website-www.emoji.icu-0ea5e9?style=flat-square&logo=googlechrome&logoColor=white)](https://www.emoji.icu)
![Platform](https://img.shields.io/badge/Platform-AI%20Visual%20Asset%20Production-111827?style=flat-square)
![Role](https://img.shields.io/badge/Role-User%20Portal%20%26%20Workspace-2563eb?style=flat-square)

> User-facing Visual Asset Portal & AI Creation Workspace

**Live Website:** [https://www.emoji.icu](https://www.emoji.icu)

## 1) 定位（Positioning）

本仓库是元都AI用户端前台，承接平台的内容消费与创作转化：

- 视觉资产浏览：合集、单图、专题推荐
- AI 创作工作台：视频转图片任务发起与结果管理
- 个人资产中心：收藏、作品、下载、权益

---

## 2) 架构总览图（Architecture Overview）

![Yuandu AI Architecture Overview](./docs/assets/architecture-overview.png)

---

## 3) 平台连接关系（Platform Topology）

```mermaid
flowchart LR
    User[User Browser] --> FW[Frontweb<br/>Next.js App]
    FW --> API[Backend API]
    API --> DB[(PostgreSQL)]
    API --> MQ[(Redis / Asynq)]
    MQ --> WK[Workers]
    WK --> OSS[(Qiniu Storage)]
    FW --> OSS
```

---

## 4) 前端模块关系图（Frontend Modules）

```mermaid
flowchart TD
    AppRouter[App Router] --> PageHome[Home / Explore]
    AppRouter --> PageCreate[Create Workspace]
    AppRouter --> PageMine[Mine / Works / Favorites]
    AppRouter --> PageProfile[Subscription / Compute / Cards]

    PageCreate --> Workbench[Task Explorer + Visual Canvas + AI Console]
    PageMine --> Downloads[Download & Collection Management]

    PageHome --> APIClient[API Client]
    Workbench --> APIClient
    Downloads --> APIClient
    PageProfile --> APIClient

    APIClient --> Backend[Yuandu AI Backend]
```

---

## 5) 路线图目录（Roadmap）

| 阶段 | 方向 | 状态 |
|---|---|---|
| Phase 1 | 用户消费链路（浏览/收藏/下载）稳定化 | ✅ In Progress |
| Phase 2 | 创作工作台增强（任务可视化、结果筛选、效率优化） | 🚧 In Progress |
| Phase 3 | 创作者协作能力（模板化、批量化、团队化） | 🗓️ Planned |

---

## 6) Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

---

## 7) Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default: `http://localhost:5918`

---

## 8) Environment

```bash
NEXT_PUBLIC_API_BASE=/api
```

- Local direct backend: `http://localhost:5050/api`
- Production: recommend Nginx reverse proxy on `/api`

---

## 9) Build & Run

```bash
npm run build
npm run start
```

---

## 10) Deployment

See: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

---

## 11) License

See `LICENSE`.
