# mosaic-mcp

[MCP server](https://modelcontextprotocol.io) for [Mosaic](https://github.com/crayonlu/Mosaic) — a journaling and diary app. Exposes 35 tools for querying memos, diaries, AI bots, memory, stats, and admin features via the Model Context Protocol (stdio transport).

## Installation

```bash
npm install mosaic-mcp
# or
bun add mosaic-mcp
```

## Configuration

| Variable            | Required | Description                                               |
| ------------------- | -------- | --------------------------------------------------------- |
| `MOSAIC_SERVER_URL` | ✅       | URL of your Mosaic backend (e.g. `http://localhost:3001`) |
| `MOSAIC_TOKEN`      | ✅\*     | JWT access token for authentication                       |
| `MOSAIC_USERNAME`   | ✅\*     | Username (paired with `MOSAIC_PASSWORD`)                  |
| `MOSAIC_PASSWORD`   | ✅\*     | Password (paired with `MOSAIC_USERNAME`)                  |

Provide either `MOSAIC_TOKEN` or both `MOSAIC_USERNAME` + `MOSAIC_PASSWORD`.

## Usage

### Direct execution

```bash
MOSAIC_SERVER_URL=http://localhost:3001 \
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
        "MOSAIC_SERVER_URL": "http://localhost:3001",
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
MOSAIC_SERVER_URL=http://localhost:3001 \
  MOSAIC_TOKEN=your-jwt-token \
  npx mosaic-mcp
```

Then configure your MCP client to launch this command via stdio.

## Tools

### Memos (10)

| Tool              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `memos_search`    | Full-text search with tag/date filtering and semantic search |
| `memos_list`      | List memos with pagination                                   |
| `memos_get`       | Get a memo by ID                                             |
| `memos_create`    | Create a new memo                                            |
| `memos_update`    | Update memo content, tags, or diary date                     |
| `memos_delete`    | Permanently delete a memo                                    |
| `memos_archive`   | Archive a memo (optionally into a diary date)                |
| `memos_unarchive` | Restore an archived memo                                     |
| `memos_tags`      | List all tags with usage counts                              |
| `memos_clip`      | Clip URL/text/image → new memo with AI summary               |

### Diaries (5)

| Tool                       | Description                                |
| -------------------------- | ------------------------------------------ |
| `diaries_list`             | List diary entries with date range filter  |
| `diaries_get`              | Get a diary entry by date (+ linked memos) |
| `diaries_create_or_update` | Create or update a diary entry             |
| `diaries_update_summary`   | Update diary summary text                  |
| `diaries_update_mood`      | Update mood key and score                  |

### Bots (5)

| Tool                   | Description                   |
| ---------------------- | ----------------------------- |
| `bots_list`            | List all AI bots              |
| `bots_get_replies`     | Get AI replies for a memo     |
| `bots_get_thread`      | Get full conversation thread  |
| `bots_trigger_replies` | Trigger AI replies for a memo |
| `bots_reply`           | Send a follow-up to a bot     |

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

### Admin (3)

| Tool                     | Description                        |
| ------------------------ | ---------------------------------- |
| `admin_get_ai_config`    | Get AI provider configuration      |
| `admin_update_ai_config` | Update AI provider settings        |
| `admin_backfill_memory`  | Trigger full memory index backfill |

### Resources (2)

| Tool             | Description                         |
| ---------------- | ----------------------------------- |
| `resources_list` | List uploaded files with pagination |
| `resources_get`  | Get resource details by ID          |

## Development

```bash
# From the Mosaic monorepo root
bun run build:mcp      # Build the server
bun run mcp:start      # Run it (requires MOSAIC_SERVER_URL env)
```

## License

AGPL-3.0
