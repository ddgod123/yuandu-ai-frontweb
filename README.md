# 元都AI Frontweb（用户端）

元都AI（Yuandu AI）是一个工业级 AI 视觉资产生产平台。  
本仓库为用户端前台，定位为「**视觉资产入口 + AI 创作工作台**」，提供：

- 视觉资产浏览（合集、单图、专题等）
- 视频转视觉资产的创作入口与任务流
- 我的收藏、我的作品、下载与管理
- 订阅、算力、次卡等权益页面

---

## 1. 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

---

## 2. 本地开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认访问：`http://localhost:5918`

---

## 3. 环境变量

`.env.local` 示例：

```bash
NEXT_PUBLIC_API_BASE=/api
```

说明：

- 本地直连后端可改为 `http://localhost:5050/api`
- 生产建议走 Nginx 反代 `/api`

---

## 4. 构建与启动

```bash
npm run build
npm run start
```

---

## 5. 部署说明

见：[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

---

## 6. 开源注意事项

- 不提交 `.env.local`、私钥、证书文件
- 不提交模型权重、私有提示词、训练数据（已加入 ignore 规则）

---

## 7. License

见仓库 `LICENSE`。
