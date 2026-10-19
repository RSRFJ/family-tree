# Contributing

Thanks for taking the time to contribute.

## Development setup

```bash
git clone <repo>
cd familytree
cp .env.example .env        # adjust DATABASE_URL
npm install
node --env-file=.env scripts/migrate.mjs
node --env-file=.env scripts/seed.mjs seed/family-data.json
npm run dev
```

Open http://localhost:3000

## Before opening a PR

- `npm run build` passes
- Test the affected flow manually (login, unlock, CRUD, backup…)
- Keep the existing code style (2 spaces, single quotes, CSS in `globals.css`)
- One topic per PR; describe the change and how you verified it

## Commit messages

Conventional Commits are appreciated:

```
feat: add mother-side relations
fix: keep audit target name after purge
docs: clarify DATABASE_URL
```

## Translations / docs

Chinese is the primary language; English improvements are welcome.
