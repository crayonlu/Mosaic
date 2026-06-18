# Project Instructions

## Tech Stack

- **Mobile**: Expo React Native (TypeScript) — Expo Router, Zustand, TanStack React Query
- **Server**: Rust (Actix Web, SQLx) — PostgreSQL + pgvector
- **Monorepo**: Turborepo + Bun workspaces
- **Admin UI**: React (Vite + Tailwind CSS 4 + shadcn)
- **AI**: Multi-provider HTTP client (OpenAI-compatible)
- **Sync**: Custom sync engine over REST

## Code Style

- **Naming**: kebab-case files, PascalCase components, camelCase API fields
- **Formatting**: Prettier — no semicolons, single quotes, 2-space indent, trailing es5 commas, 100 print width
- **Imports**: ESM with `@/` path alias for mobile app, `workspace:*` for monorepo packages
- **ESLint**: Flat config — TypeScript strict + React + React Hooks recommended rules
- **Error handling (Rust)**: Typed `AppError` enum via `thiserror`, `ResponseError` trait for HTTP mapping
- **State**: Zustand for client state, TanStack Query for server state, MMKV for persistence

## Testing

- No test runner is currently configured
- Test files are not yet present in the repo

## Build & Run

| Task               | Command                             |
| ------------------ | ----------------------------------- |
| Mobile dev         | `bun mobile:start`                  |
| Mobile Android     | `bun mobile:android`                |
| Mobile iOS         | `bun mobile:ios`                    |
| Run all checks     | `bun run check`                     |
| Lint               | `bun run lint`                      |
| Typecheck          | `bun run typecheck`                 |
| Format             | `bun run format`                    |
| Build all packages | `bun run build`                     |
| Server (native)    | `cd server && cargo run`            |
| Server (Docker)    | `cd server && docker-compose up -d` |
| Admin UI dev       | `cd server/admin-ui && bun run dev` |

## Project Structure

```
mobile/          → Expo React Native app (file-based routing)
server/          → Rust Actix Web backend + admin UI + Docker
packages/api/    → HTTP client + shared type definitions
packages/sync/   → Sync engine (server-local reconciliation)
packages/cache/  → Abstract cache layer
packages/utils/  → HTML processing, design tokens, mood utilities
docsite/         → Documentation site (Next.js + Fumadocs)
docs/            → Raw documentation (API ref, release guide, known issues)
```

## Conventions

- **Commits**: Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`)
- **Git hooks**: Husky manages pre-commit checks
- **API fields**: camelCase (Rust Serde `#[serde(rename_all = "camelCase")]`)
- **API auth**: JWT Bearer token via `Authorization` header
- **DB migrations**: Raw SQL timestamped files in `server/migrations/`
- **Sync**: CRDT-like reconciliation with client-side SQLite/MMKV
- **AI config**: Multi-provider support configured via admin dashboard or environment
