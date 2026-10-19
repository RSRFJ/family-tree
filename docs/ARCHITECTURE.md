# 架构与数据模型

## 总览

```
Browser
  │
  ├── /            访问码页（未登录）
  ├── /preview     预览（只读，ft_preview Cookie）
  └── /admin       管理（ft_admin Cookie，角色 admin/user）
        │
        ▼
   Next.js 15 (standalone, Node 22)
        │  pg Pool (DATABASE_URL)
        ▼
   PostgreSQL 17  ◀── backup 容器（crond，每日 03:00）
        │
        └── data/postgres（宿主机 bind mount）
```

## 容器

| 服务 | 作用 | 生命周期 |
|---|---|---|
| `db` | PostgreSQL 17 | 常驻 |
| `migrate` | 执行 `db/schema.sql` | 一次性 |
| `seed` | 导入示例数据/默认管理员/默认访问码（有数据则跳过） | 一次性 |
| `web` | Next.js standalone，监听 3000 | 常驻 |
| `backup` | 清理审计 + pg_dump + 7 份轮换 | 常驻 |

`web` 只读挂载 `data/backups`，用于管理页下载最新 `.dump`。

## 请求流程

### 预览解锁

1. `POST /api/preview/unlock { code }`
2. 逐条比对 `access_codes`（`timingSafeEqual`），命中则累加 `use_count`
3. 生成随机 token，`sha256` 存 `preview_sessions`，有效期 12 小时
4. 下发 `ft_preview` Cookie（HttpOnly、SameSite=Lax、**无 Max-Age**）
5. `/preview`、`/preview/tree` 校验会话，否则 307 回 `/`

### 管理登录

1. `POST /api/auth/login { username, password }`
2. scrypt 校验（N=32768, r=8, p=1）
3. `sessions` 存 token 哈希，30 天；`ft_admin` Cookie
4. 每个管理页 `requireAdmin()`；敏感页再校验 `role === 'admin'`

## 数据模型

| 表 | 关键字段 | 说明 |
|---|---|---|
| `family` | `title, description, logo_text, notice` | 单行站点设置 |
| `person` | `legacy_id, display_name, gender, generation, birth/death_year, notes, version, deleted_at` | 人物；软删除 |
| `parent_child` | `parent_id, child_id, role` | 父子关系；唯一约束 + 防环触发器 |
| `users` | `username, password_hash, role('admin'/'user'), is_active` | 管理账号 |
| `sessions` | `token_hash, user_id, expires_at` | 管理员会话 |
| `preview_sessions` | `token_hash, expires_at` | 预览会话 |
| `access_codes` | `code, label, is_active, use_count` | 多访问码 |
| `audit_log` | `actor_id, action, entity, entity_id, payload, created_at` | 审计，保留 1 年 |

### 不变量

- **世代**：保存后全树重算，根为 1，子为父 + 1（不信任客户端传值）
- **防环**：数据库触发器拒绝成环；API 预检返回 422
- **乐观锁**：更新带 `version`，冲突 409
- **软删除**：只有 `purge` 物理删除；审计写入姓名快照
- **访问码失效**：停用/删除任意访问码会清空所有预览会话

## 安全模型

| 面 | 措施 |
|---|---|
| 密码 | scrypt + 随机盐 |
| 会话 | 随机 token，仅存哈希；HttpOnly Cookie |
| 访问码 | 大小写不敏感、定长比较；限流 10 次/分钟/IP |
| 登录 | 限流 20 次/10 分钟/IP；错误统一提示 |
| SQL | 全部参数化 |
| XSS | 不渲染 HTML，React 转义 |
| 越权 | 页面 307 + API 403；角色只有两级 |
| 备份 | 仅 admin 下载；`.dump` 只读挂载 |
| 索引 | `robots: noindex` |

## 备份分层

| 层 | 文件 | 恢复 |
|---|---|---|
| 数据库 | `data/backups/*.dump`（PGDMP） | `pg_restore` |
| 族谱数据 | JSON（站点 + 人物 + 关系） | 管理页导入 |
| 账号凭据 | JSON（含 scrypt 哈希 + 访问码） | 管理页导入 |

每日 03:00 顺序：删除一年前审计 → `pg_dump` → 保留 7 份。
