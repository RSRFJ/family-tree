# 镜像包说明

## 为什么不放在 Git 仓库里

镜像包 `familytree-v1.0.0-images.tar.gz` 约 **181 MB**，超过 GitHub 单文件 100 MB 限制，
也无法有效做文本 diff。它作为 **Release 附件**分发，源码仓库只保留构建文件。

## 下载

- Release 页面：https://github.com/RSRFJ/family-tree/releases/tag/v1.0.0
- 直接下载：https://github.com/RSRFJ/family-tree/releases/download/v1.0.0/familytree-v1.0.0-images.tar.gz

校验：

```bash
sha256sum -c SHA256SUMS
# 期望：以 Release 的 SHA256SUMS 为准
```

## 包含的镜像（4 个）

| 镜像 | 用途 |
|---|---|
| `familytree-web:1.0.0` | Next.js standalone 应用 |
| `familytree-tools:1.0.0` | migrate / seed 脚本 |
| `familytree-backup:1.0.0` | 每日备份 + 审计清理 |
| `postgres:17-alpine` | 数据库 |

架构：`linux/amd64`。`node:22-alpine` 仅构建阶段使用，不在包内。

## 导入并启动（离线可用）

```bash
docker load -i familytree-v1.0.0-images.tar.gz

cp .env.example .env
# 修改 POSTGRES_PASSWORD、DATABASE_URL、ADMIN_PASSWORD、PREVIEW_CODE

docker compose -f compose.release.yaml up -d
```

首次启动会建表并导入示例族谱，访问 `http://<host>:3001/`。

## 从源码构建（开发者）

```bash
docker compose up -d --build
```

两者使用同一套镜像 tag 规则；发布新版本时重新 `docker save` 即可。
