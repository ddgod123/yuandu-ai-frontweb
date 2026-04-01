# Frontweb 部署说明（生产）

## 1. 依赖

- Node.js 20+
- npm 10+
- Nginx（推荐）

---

## 2. 构建

```bash
cd frontweb
npm ci --include=dev
npm run build
```

---

## 3. 运行环境变量

创建生产环境文件（示例）：

```bash
cat >/etc/emoji/frontweb.env <<'EOF'
NODE_ENV=production
NEXT_PUBLIC_API_BASE=/api
EOF
```

---

## 4. systemd

`/etc/systemd/system/emoji-frontweb.service`

```ini
[Unit]
Description=Emoji Frontweb
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/emoji/frontweb
EnvironmentFile=/etc/emoji/frontweb.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启用：

```bash
systemctl daemon-reload
systemctl enable --now emoji-frontweb
```

---

## 5. Nginx 反向代理

将站点根路径转发到 `127.0.0.1:5918`，并把 `/api/` 转发到后端 `127.0.0.1:5050`。

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:5050;
}

location / {
  proxy_pass http://127.0.0.1:5918;
}
```

---

## 6. 验证

```bash
curl -I http://127.0.0.1:5918
systemctl status emoji-frontweb --no-pager
```

