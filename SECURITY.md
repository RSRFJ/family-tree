# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | ✅ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting (Security → Advisories → Report a
vulnerability).

We aim to acknowledge reports within 72 hours.

## Deployment notes

This project is designed for **private / intranet** use:

- Put it behind HTTPS (Caddy / Nginx) before exposing it to the internet.
- Change the default admin password and preview code immediately.
- Treat `data/backups` and account export JSON as secrets (they contain
  password hashes).
- Keep the Docker images updated; Next.js security advisories apply to the
  app router.
