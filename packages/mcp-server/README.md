# mosaic-mcp

[MCP server](https://modelcontextprotocol.io) for [Mosaic](https://github.com/crayonlu/Mosaic) — a journaling and diary app. Exposes 50 tools for querying memos, diaries, AI bots, memory, stats, resources, and admin features via the Model Context Protocol (stdio transport). All tools are thin wrappers over the shared `@mosaic/api` client used by the mobile app.

## Installation

```bash
npm install mosaic-mcp
# or
bun add mosaic-mcp
```

## Configuration

| Variable            | Required | Description                                               |
| ------------------- | -------- | --------------------------------------------------------- |
| `MOSAIC_SERVER_URL` | ✅       | URL of your Mosaic backend (e.g. `http://localhost:8080`) |
| `MOSAIC_TOKEN`      | ✅\*     | JWT access token for authentication                       |
| `MOSAIC_USERNAME`   | ✅\*     | Username (paired with `MOSAIC_PASSWORD`)                  |
| `MOSAIC_PASSWORD`   | ✅\*     | Password (paired with `MOSAIC_USERNAME`)                  |

Provide either `MOSAIC_TOKEN` or both `MOSAIC_USERNAME` + `MOSAIC_PASSWORD`.

- **Token mode**: the token is used as-is. Access tokens expire (7-day TTL) — restart the server with a fresh token when authentication fails.
- **Credential mode**: the server logs in at startup and stores the refresh token, so authentication refreshes automatically.

## Usage

### Direct execution

```bash
MOSAIC_SERVER_URL=http://localhost:8080 \
  MOSAIC_USERNAME=admin \
  MOSAIC_PASSWORD=yourpassword \
  npx mosaic-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mosaic": {
      "command": "npx",
      "args": ["mosaic-mcp"],
      "env": {
        "MOSAIC_SERVER_URL": "http://localhost:8080",
        "MOSAIC_USERNAME": "admin",
        "MOSAIC_PASSWORD": "yourpassword"
      }
    }
  }
}
```

### Pi / Other MCP clients

```bash
# Run the server
MOSAIC_SERVER_URL=http://localhost:8080 \
  MOSAIC_TOKEN=your-jwt-token \
  npx mosaic-mcp
```

Then configure your MCP client to launch this command via stdio.

## Tools

### Auth (1)

| Tool       | Description                            |
| ---------- | -------------------------------------- |
| `auth_me`  | Get the current authenticated user (id, username, role) |

### Memos (14)

| Tool                        | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `memos_search`              | Full-text search with tag/date filtering and semantic search     |
| `memos_list`                | List memos with pagination                                       |
| `memos_get`                 | Get a memo by ID                                                 |
| `memos_detail`              | Get a memo with resources, revision history, and bot replies     |
| `memos_by_date`             | List memos created on a specific date (server timezone)          |
| `memos_create`              | Create a new memo (content, tags, resources, AI summary)         |
| `memos_update`              | Update memo content, tags, resources, summary, or diary date     |
| `memos_delete`              | Permanently delete a memo                                        |
| `memos_archive`             | Archive a memo (optionally into a diary date)                    |
| `memos_unarchive`           | Restore an archived memo                                         |
| `memos_tags`                | List all tags with usage counts                                  |
| `memos_clip`                | Clip URL/text/image → new memo with AI summary                   |
| `memos_revisions`           | Get the full revision history of a memo                          |
| `memos_delete_revision`     | Delete a memo revision (last revision cannot be deleted)         |

### Diaries (5)

| Tool                       | Description                                |
| -------------------------- | ------------------------------------------ |
| `diaries_list`             | List diary entries with date range filter  |
| `diaries_get`              | Get a diary entry by date (+ linked memos) |
| `diaries_create_or_update` | Create or update a diary entry             |
| `diaries_update_summary`   | Update diary summary text                  |
| `diaries_update_mood`      | Update mood key and score (1-10)           |

### Bots (10)

| Tool                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `bots_list`            | List all AI bots                         |
| `bots_get`             | Get a single bot by ID                   |
| `bots_create`          | Create a new bot                         |
| `bots_update`          | Update a bot                             |
| `bots_delete`          | Delete a bot                             |
| `bots_reorder`         | Set bot display order                    |
| `bots_get_replies`     | Get AI replies for a memo                |
| `bots_get_thread`      | Get full conversation thread             |
| `bots_trigger_replies` | Trigger AI replies (then poll `bots_get_replies`) |
| `bots_reply`           | Send a follow-up to a bot                |

### Memory (4)

| Tool                   | Description                             |
| ---------------------- | --------------------------------------- |
| `memory_stats`         | Get total/indexed memo counts           |
| `memory_activity`      | Recent memory retrieval activity        |
| `memory_context`       | Relevant past memos for a memo+bot pair |
| `memory_memo_contexts` | Memory contexts across all bots         |

### Stats (4)

| Tool             | Description                            |
| ---------------- | -------------------------------------- |
| `stats_heatmap`  | Activity heatmap data for a date range |
| `stats_timeline` | Timeline entries with mood summaries   |
| `stats_trends`   | Mood and tag trends                    |
| `stats_summary`  | Monthly summary totals                 |

### AI (2)

| Tool              | Description                 |
| ----------------- | --------------------------- |
| `ai_summarize`    | Generate AI summary of text |
| `ai_suggest_tags` | Suggest tags for content    |

### Resources (3)

| Tool               | Description                                               |
| ------------------ | --------------------------------------------------------- |
| `resources_list`   | List uploaded files with pagination                       |
| `resources_get`    | Get resource details by ID                                |
| `resources_upload` | Upload a file (base64 data) → resource with download URL  |

`resources_upload` accepts `filename`, `mimeType`, `dataBase64` (max 20MB), and optional `memoId` / `metadata`. Use the returned resource ID with `memos_create` (`resourceIds`) or `memos_clip` (`image` type).

### Admin (7) — requires an admin account

| Tool                     | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `admin_get_ai_config`    | Get AI provider configuration                    |
| `admin_update_ai_config` | Update AI provider settings                      |
| `admin_backfill_memory`  | Trigger memory index backfill (async; observe via `admin_activity`) |
| `admin_settings_get`     | Get global app settings (auto-tag/summary/diary, timezone) |
| `admin_settings_update`  | Update global app settings (all fields required) |
| `admin_health`           | Server health and storage usage                  |
| `admin_activity`         | Recent admin activity log (in-memory, last 200 entries) |

## Development

```bash
# From the Mosaic monorepo root
bun run build:mcp      # Build the server
bun run mcp:start      # Run it (requires MOSAIC_SERVER_URL env)
bun --filter mosaic-mcp smoke   # End-to-end smoke test against a mock server
```

## License

AGPL-3.0
