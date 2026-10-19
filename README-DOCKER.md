# 家族族谱 · Docker 部署包 v1.0.0

开箱即用的家族族谱系统：访问码预览 + 管理员维护，PostgreSQL 持久化，每日自动备份。

---

## 1. 包内容

| 文件 | 说明 |
|---|---|
| `familytree-v1.0.0-images.tar.gz` | 全部镜像（web / tools / backup / postgres:17-alpine） |
| `compose.yaml` | 服务编排（5 个服务） |
| `default.env.example` | 环境变量模板，复制为 `.env` 后修改 |
| `seed/family-data.json` | 示例族谱已内置在 tools 镜像；如需替换，可挂载 `./seed` |
| `SHA256SUMS` | 镜像包校验值 |
| `README-DOCKER.md` | 本说明 |

镜像清单：

| 镜像 | 用途 | 大小 |
|---|---|---|
| `familytree-web:1.0.0` | Next.js 应用（端口 3000） | ~200 MB |
| `familytree-tools:1.0.0` | 迁移 / 种子脚本（一次性） | ~170 MB |
| `familytree-backup:1.0.0` | 每日备份 + 审计清理 | ~297 MB |
| `postgres:17-alpine` | 数据库 | ~297 MB |

---

## 2. 系统要求

- Docker 24+，Docker Compose v2
- 内存 ≥ 1 GB，磁盘 ≥ 2 GB（不含备份增长）
- 架构：**x86_64**（群晖 DS918+ 等 Intel 机型）；ARM 需自行重新构建
- 端口：默认 `3001`（可在 `.env` 改）

---

## 3. 快速开始

```bash
# 1) 把本目录放到服务器（示例）
mkdir -p /volume1/docker/familytree && cd /volume1/docker/familytree
# 确保 compose.yaml / default.env.example / seed/ / 镜像包都在此目录

# 2) 导入镜像（约 1-3 分钟）
docker load -i familytree-v1.0.0-images.tar.gz

# 3) 配置环境变量
cp default.env.example .env
vi .env          # 至少修改 POSTGRES_PASSWORD 和 DATABASE_URL

# 4) 启动（首次会自动建表 + 导入示例数据）
docker compose up -d

# 5) 查看状态
docker compose ps
docker compose logs -f --tail=50 web
```

群晖等需要 sudo 的环境，在 `docker` 前加 `sudo`。

启动完成后：

- 族人入口：`http://<服务器IP>:3001/` —— 输入 `.env` 里的 `PREVIEW_CODE`（默认 `welcome`）
- 管理入口：首页「进入族谱」下方的「管理员入口」，或 `http://<服务器IP>:3001/admin`
- 默认账号：`admin` / `admin`（部署后请立刻修改）

> 首次启动时 `seed` 会把 `seed/family-data.json` 导入数据库；如果库里已有人物则自动跳过。
> 生产环境请配置 HTTPS：参见仓库 `docs/HTTPS.md`，并设置 `COOKIE_SECURE=1`、`TRUST_PROXY=1`。

---

## 4. 目录结构

```
familytree-v1.0.0/
├── compose.yaml
├── .env
├── seed/
│   └── family-data.json
└── data/                 # 首次启动自动创建
    ├── postgres/         # 数据库文件（必须持久化）
    ├── backups/          # 每日 .dump（保留 7 份）
    └── uploads/          # 预留
```

**务必保留 `data/` 目录**，删掉等于删库。

---

## 5. 配置说明（.env）

| 变量 | 必填 | 说明 |
|---|---|---|
| `POSTGRES_DB` | 否 | 数据库名，默认 `familytree` |
| `POSTGRES_USER` | 否 | 数据库用户，默认 `familytree` |
| `POSTGRES_PASSWORD` | **是** | 数据库密码，请使用强密码 |
| `DATABASE_URL` | **是** | 连接串 `postgres://用户:密码@db:5432/库名`，必须与上面三项一致 |
| `ADMIN_USER` | 否 | 初始管理员用户名，默认 `admin` |
| `ADMIN_PASSWORD` | **是** | 初始管理员密码（≥8 位） |
| `PREVIEW_CODE` | 否 | 初始访问码（4–32 位字母数字），仅在无访问码时导入 |
| `WEB_PORT` | 否 | 对外端口，默认 `3001` |
| `TZ` | 否 | 时区，默认 `Asia/Shanghai` |

说明：
- `ADMIN_*` 与 `PREVIEW_CODE` 只在**空库第一次启动**时使用；之后在管理页修改
- 改 `.env` 里的密码不会改已存在的数据库密码/管理员密码
- `DATABASE_URL` 是应用实际使用的连接串；修改数据库密码时，**必须同时改 `POSTGRES_PASSWORD` 和 `DATABASE_URL`**（密码含 `@ : / #` 等字符要做 URL 编码）

---

## 6. 首次使用

1. 打开 `/`，输入访问码，确认能看到人物列表与树状图
2. 打开 `/admin`，用 `ADMIN_USER` / `ADMIN_PASSWORD` 登录
3. **立即修改密码**：账号 → 我的账号 → 更新密码
4. **修改访问码**：账号 → 访问码 → 停用默认码、新增自己的码
5. **站点设置**：改标题、简介、印章、公告
6. 导入真实族谱：
   - 少量：直接在「人物列表」新增/编辑
   - 批量：按 `seed/family-data.json` 的结构准备 JSON，在「数据备份 → 从备份恢复」导入

---

## 7. 日常运维

```bash
# 状态 / 日志
docker compose ps
docker compose logs -f --tail=100 web
docker compose logs backup

# 停止 / 启动（数据保留）
docker compose stop
docker compose start

# 彻底删除容器（数据仍在 ./data）
docker compose down
```

### 升级到新版本

```bash
docker load -i familytree-vX.Y.Z-images.tar.gz
# 修改 compose.yaml 里的镜像 tag，或直接：
docker compose up -d
```

数据库结构变更由 `migrate` 容器在启动时自动执行（幂等）。

---

## 8. 数据备份与恢复

### 8.1 自动备份

- 每天 **03:00**：先删除一年前的审计日志，再 `pg_dump`，只保留 **7 份**
- 位置：`data/backups/familytree-YYYYmmdd-HHMMSS.dump`
- 手动触发：

```bash
docker compose exec backup sh /usr/local/bin/backup.sh
```

### 8.2 应用级导出

管理端 →「数据备份」：

- 账号与访问码备份（JSON，含 scrypt 哈希）
- 家谱数据备份（JSON，不含密码）
- 数据库文件 `.dump` 下载（最新一份）

### 8.3 用 .dump 恢复

```bash
# 停止写入
docker compose stop web

# 恢复（会覆盖现有库）
docker compose exec -T db pg_restore -U familytree -d familytree --clean --if-exists \
  < data/backups/familytree-XXXXXXXX-XXXXXX.dump

# 或先 drop/create
docker compose exec -T db psql -U familytree -d postgres -c 'DROP DATABASE familytree;'
docker compose exec -T db psql -U familytree -d postgres -c 'CREATE DATABASE familytree;'
docker compose exec -T db pg_restore -U familytree -d familytree < data/backups/xxx.dump

docker compose start web
```

> `.dump` 建议在服务器上恢复；网页里的「从备份恢复」用于 JSON。

---

## 9. 常见问题

| 现象 | 处理 |
|---|---|
| 网页打不开 / 502 | `docker compose ps` 看 web 是否 healthy；`docker compose logs web` |
| 端口被占用 | 改 `.env` 的 `WEB_PORT`，`docker compose up -d` |
| 登录后立刻退出 | 检查服务器时间、浏览器是否禁用 Cookie |
| 忘记管理员密码 | 用 `familytree-tools` 重置：见下方命令 |
| 备份目录为空 | 确认 backup 容器在运行；看 `docker compose logs backup` |
| 首页仍是旧标题 | Ctrl+F5 强刷（服务端已 no-store） |

重置管理员密码（在部署目录执行）：

```bash
# 1) 生成 scrypt 哈希（密码至少 8 位）
docker run --rm familytree-tools:1.0.0 node scripts/password.mjs '新密码'

# 2) 写回数据库（把 <哈希> 换成上一步输出）
docker compose exec db psql -U familytree -d familytree \
  -c "UPDATE users SET password_hash='<哈希>' WHERE username='admin';"
```

重置后旧会话仍有效，如需强制下线：

```bash
docker compose exec db psql -U familytree -d familytree -c "DELETE FROM sessions;"
```

---

## 10. 安全建议

1. 修改默认管理员密码与访问码，不要用示例值
2. 只在内网或 VPN 内使用；公网暴露请加 HTTPS 反向代理（Caddy/Nginx）
3. `data/` 与 `.env` 权限收紧（`.env` 建议 600）
4. 账号备份 JSON 含密码哈希，按凭据管理，勿外发
5. 定期把 `data/backups` 同步到另一台设备（本机 7 份仍可能随磁盘损坏丢失）

---

## 11. 版本与校验

- 版本：`1.0.0`（对应应用 v4.10）
- 校验：`sha256sum -c SHA256SUMS`
- 构建架构：`linux/amd64`
