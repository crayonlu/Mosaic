# Mosaic Admin Dashboard

[简体中文](./README.zh.md) | English

Web-based admin dashboard for the Mosaic server, built with Vite + React 19 + shadcn/ui.

## Access

Once the server is running, open `http://<your-server>:8080/admin` in your browser.

**Default credentials** (change in production):

| Field | Default |
|-------|---------|
| Username | `admin` |
| Password | `admin123` |

Configured via the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| UI | shadcn/ui + Tailwind CSS 4 + Geist font |
| Icons | Lucide React |
| Routing | React Router 7 |
| State | Zustand |
| i18n | i18next (Chinese / English) |
| API | ofetch |

## Project Structure

```
admin-ui/
├── src/
│   ├── api/              # Backend API client (ofetch)
│   ├── components/       # Shared UI components
│   │   └── ui/           # shadcn/ui primitives
│   ├── hooks/            # Custom hooks
│   ├── layouts/          # Layout components
│   ├── lib/              # Utilities (i18n, etc.)
│   ├── locales/          # Translation files
│   ├── router/           # Route config + auth guard
│   ├── stores/           # Zustand state stores
│   └── views/            # Page views
│       ├── Dashboard.tsx # Dashboard home
│       ├── Bots.tsx      # Bot management
│       └── Login.tsx     # Login page
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/login` | Login | Enter server URL and credentials |
| `/dashboard` | Dashboard | Server health, stats, AI config, automation, bots, memory |
| `/bots` | Bots | Create / edit / delete AI bots |

All routes (except `/login`) require authentication. Unauthenticated users are redirected to the login page.

## Features

### Health Monitoring

- Server status / version / uptime
- Storage usage / database size
- Recent activity log

### AI Configuration

Two independent AI providers can be configured:

| Config | Purpose | Example Models |
|--------|---------|----------------|
| **Bot Config** | Chat generation, tagging, summarization, diary | GPT-4o, Claude, Ollama |
| **Embedding Config** | Vector embeddings (semantic search) | text-embedding-3-small, nomic-embed-text |

Each config supports: Provider (OpenAI / Anthropic), Base URL, API Key, Model, Temperature, Max Tokens, Timeout.

### Automation Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Auto Tag | On | Auto-tag memos on creation |
| Auto Summary | Off | Generate AI summaries for each memo |
| Auto Diary | On | Auto-generate daily diary entries |
| Min Memos | 2 | Minimum memos to trigger auto diary |
| Min Chars | 150 | Minimum total chars to trigger auto diary |
| Timezone | Asia/Shanghai | Timezone for diary date calculation |

### Bot Management

Create and manage AI bots. Each bot can have:
- Name / avatar / description / tags
- Auto-reply toggle
- Sort order

### Memory Panel

View vector embedding status. Supports manual backfill to generate embeddings for memos that don't have them yet.

## Local Development

```bash
# Install dependencies
cd server/admin-ui && bun install

# Start dev server (default 127.0.0.1:5173, API proxies to server)
bun run dev

# Build for production (output to server/static/admin/)
bun run build

# Lint
bun run lint

# Type check
bun run typecheck
```

> Make sure the Mosaic server is running during development, or set `SERVER_URL` to connect to a remote server.

## Build Output

The production build outputs to `server/static/admin/`, which is served directly by the Rust backend via Actix Files. Restart the server after building to see changes.
