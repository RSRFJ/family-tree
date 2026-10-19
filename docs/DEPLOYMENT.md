# 部署与运维

## 前置要求

- Docker 24+ / Compose v2
- 内存 ≥ 1 GB，磁盘 ≥ 2 GB
- 架构 `linux/amd64`（预构建镜像）；ARM 请自行 `docker compose build`

## 方式一：源码构建（推荐开发者）

```bash
git clone <repo>
cd familytree
cp .env.example .env
vi .env
docker compose up -d --build
```

## 方式二：预构建镜像

```bash
docker load -i familytree-v1.0.0-images.tar.gz
cp .env.example .env
vi .env
docker compose -f compose.release.yaml up -d
```

## 环境变量

| 变量 | 必填 | 示例 |
|---|---|---|
| `POSTGRES_DB` | 否 | `familytree` |
| `POSTGRES_USER` | 否 | `familytree` |
| `POSTGRES_PASSWORD` | 是 | 强密码 |
| `DATABASE_URL` | 是 | `postgres://familytree:***@db:5432/familytree` |
| `ADMIN_USER` | 否 | `admin` |
| `ADMIN_PASSWORD` | 是 | 默认 `admin`，部署后请立即修改 |
| `PREVIEW_CODE` | 否 | 默认 `welcome`，部署后请立即修改 |
| `TRUST_PROXY` | 否 | 放在可信反代后设为 `1`，否则限流按直连处理 |
| `COOKIE_SECURE` | 否 | 全站 HTTPS 后设为 `1` |
| `WEB_PORT` | 否 | `3001` |
| `TZ` | 否 | `Asia/Shanghai` |

> `DATABASE_URL` 的密码要做 URL 编码；改库密码时两处都要改。
> 默认 `admin/admin` 与 `welcome` 只用于首次体验，公网/多人环境必须改掉。

## 首次启动

```bash
docker compose ps
docker compose logs -f migrate seed web
curl http://127.0.0.1:3001/api/health
# {"ok":true,"people":17,"relations":16,...}
```

浏览器打开 `http://<host>:3001/`：

1. 用 `PREVIEW_CODE` 解锁预览
2. 「管理员入口」用 `ADMIN_USER` / `ADMIN_PASSWORD` 登录
3. 立即修改密码、访问码、站点标题与公告

## HTTPS（Caddy 示例）

```caddyfile
family.example.com {
    reverse_proxy 127.0.0.1:3001
    encode gzip
}
```

若要公网暴露，建议同时在反代层加基础认证或 IP 白名单。

## 备份

自动：每日 03:00，`data/backups/familytree-*.dump`，保留 7 份。

手动：

```bash
docker compose exec backup sh /usr/local/bin/backup.sh
```

管理页可下载：账号 JSON、族谱 JSON、最新 `.dump`。

## 恢复

### JSON

管理 → 数据备份 → 从备份恢复 → 选择文件 → 输入 `RESTORE`。
会清空人物与关系（含回收站）后重建，事务内完成。

### .dump

```bash
docker compose stop web
docker compose exec -T db pg_restore -U familytree -d familytree \
  --clean --if-exists < data/backups/familytree-YYYYmmdd-HHMMSS.dump
docker compose start web
```

或从零恢复：

```bash
docker compose stop web
docker compose exec -T db psql -U familytree -d postgres -c 'DROP DATABASE familytree;'
docker compose exec -T db psql -U familytree -d postgres -c 'CREATE DATABASE familytree;'
docker compose exec -T db pg_restore -U familytree -d familytree < data/backups/xxx.dump
docker compose start web
```

## 升级

```bash
git pull
docker compose up -d --build
```

`migrate` 会在启动时幂等执行 `db/schema.sql`。

## 重置管理员密码

```bash
docker run --rm familytree-tools:local node scripts/password.mjs 'NewPassword123'
# 或源码构建前：
node scripts/password.mjs 'NewPassword123'
```

把输出的 `scrypt$...` 写回：

```bash
docker compose exec db psql -U familytree -d familytree \
  -c "UPDATE users SET password_hash='scrypt$...' WHERE username='admin';"
docker compose exec db psql -U familytree -d familytree -c "DELETE FROM sessions;"
```

## 故障排查

| 现象 | 处理 |
|---|---|
| 502 / 打不开 | `docker compose ps`；`docker compose logs web` |
| 端口冲突 | 改 `WEB_PORT` 后 `docker compose up -d` |
| 登录后掉线 | 检查服务器时间、Cookie、`sessions` 表 |
| 备份为空 | `docker compose logs backup`，检查 `data/backups` 权限 |
| 页面样式旧 | Ctrl+F5；确认 `/_next/static/css/*` 200 |
| 迁移失败 | 看 `docker compose logs migrate`，通常是 `DATABASE_URL` 不对 |

## 数据目录

```
data/
├── postgres/   # 数据库文件（必须备份）
├── backups/    # .dump
└── uploads/    # 预留
```

删除 `data/` 等于删库；迁移服务器时整个目录一起带走。
