# Family Tree

A self-hosted Chinese family-tree app with **preview-code read-only access** and
**admin management**, featuring a tree view, announcements, audit log, daily
backups and mobile support.

> **Notice**: This is a **modified version** of
> [qiaoshouqing/familytree](https://github.com/qiaoshouqing/familytree) (MIT),
> not an original work. See [UPSTREAM.md](UPSTREAM.md) for what changed.

[中文 README](README.md)

## Features

- Preview code (multiple, revocable) for family members; no account needed
- Admin accounts with `admin` / `user` roles
- Person CRUD with father relations, generation auto-calculation, optimistic locking
- Soft delete + trash (30 days) + 10-second undo
- Audit log with pagination/filters, retained for 1 year
- Site settings (title, description, seal, announcement)
- Backups: daily PostgreSQL dump (7 copies), JSON export/import for data and accounts
- Responsive: collapsible sidebar, mobile drawer

## Quick start

```bash
cp .env.example .env    # set POSTGRES_PASSWORD / DATABASE_URL; defaults are admin / admin and welcome
docker compose up -d --build
```

Open http://localhost:3001

## Prebuilt images

Download `familytree-v1.0.0-images.tar.gz` from
[Releases](https://github.com/RSRFJ/family-tree/releases/tag/v1.0.0), then:

```bash
docker load -i familytree-v1.0.0-images.tar.gz
docker compose -f compose.release.yaml up -d
```

See [docs/IMAGES.md](docs/IMAGES.md).

## HTTPS

Put the app behind a TLS reverse proxy before exposing it. See [docs/HTTPS.md](docs/HTTPS.md); set `COOKIE_SECURE=1` and `TRUST_PROXY=1` after TLS is working.

## Docs

- [Deployment](docs/DEPLOYMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Changelog](docs/CHANGELOG.md)

## License

MIT. Based on [qiaoshouqing/familytree](https://github.com/qiaoshouqing/familytree) (MIT); see [NOTICE](NOTICE).
