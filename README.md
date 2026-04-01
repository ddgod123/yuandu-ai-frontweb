# Emoji Frontweb（官网）

基于 Next.js App Router 的官网前端，面向普通用户，提供：

- 首页与内容浏览
- 合集详情与下载入口
- 用户中心（我的收藏、我的作品、订阅相关页面）

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

