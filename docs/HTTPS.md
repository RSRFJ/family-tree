# HTTPS 部署

本项目自身只提供 HTTP。生产环境必须在前面放 TLS 终止（Nginx / Caddy / DSM 反向代理），
否则管理员密码、会话 Cookie 和访问码都会以明文经过局域网。

## 1. 准备证书

### 有域名（推荐）

用 Let's Encrypt / DSM 证书 / 你自己的 CA 签发证书，得到：

- `server.crt`（含中间证书的 fullchain 更好）
- `server.key`

把域名解析到服务器，反代监听 443（或映射到 3001），证书 CN/SAN 必须是该域名。

### 只有内网 IP

浏览器不信任自签证书，会显示“不安全”。可以自建一个本地 CA：

```bash
openssl genrsa -out ca.key 4096
openssl req -x509 -new -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/CN=familytree local CA/O=familytree"

cat > server.cnf <<'EOF'
[req]
distinguished_name=dn
req_extensions=req_ext
prompt=no
[dn]
CN=192.168.1.10
O=familytree
[req_ext]
subjectAltName=@alt
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
[alt]
IP.1=192.168.1.10
EOF

openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -config server.cnf
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 825 -sha256 -extfile server.cnf -extensions req_ext
```

把 `ca.crt` 安装到**每一台要访问的电脑/手机**的“受信任的根证书颁发机构”，
浏览器才不会报警。不要把 `ca.key` / `server.key` 提交到 Git。

## 2. Nginx 反代

```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name family.example.com;

  ssl_certificate     /etc/nginx/certs/server.crt;
  ssl_certificate_key /etc/nginx/certs/server.key;
  ssl_protocols TLSv1.2 TLSv1.3;

  client_max_body_size 8m;

  location / {
    proxy_pass http://web:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;              # 保留端口，CSRF 校验要用
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr; # 覆盖客户端伪造的 XFF
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

Docker Compose 中不要再给 `web` 发布宿主端口，只让反代发布 443/3001：

```yaml
services:
  web:
    # 不要 ports:
  tls:
    image: nginx:latest
    ports: ["3001:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
```

## 3. 应用环境变量

```env
TRUST_PROXY=1     # 只有上面的反代会覆盖 X-Forwarded-For 时才开
COOKIE_SECURE=1   # 确认全站 HTTPS 后必须开
```

设置后重建 web 容器：

```bash
docker compose up -d --force-recreate web tls
```

验证：

```bash
curl -I https://你的地址/
# 应看到 Strict-Transport-Security / X-Frame-Options / CSP
```

登录后检查 `ft_admin` Cookie 是否带 `Secure`；HTTP 下不要再把 `COOKIE_SECURE` 设为 1，
否则浏览器不会回传 Cookie，表现为“登录后又回到登录页”。

## 4. 常见问题

| 现象 | 原因 |
|---|---|
| 浏览器提示证书不受信任 | 自签 CA 未安装到客户端，或域名/IP 不在证书 SAN 中 |
| 登录 200 但立刻掉线 | `COOKIE_SECURE=1` 但仍在用 HTTP，或反代没传 `X-Forwarded-Proto` |
| POST 返回 403 | 反代改写了 Host/Origin；确保 `Host $http_host`，并让 `TRUST_PROXY=1` |
| 限流把所有人算成一个 IP | `TRUST_PROXY=0`；反代覆盖 XFF 后设为 1 |
