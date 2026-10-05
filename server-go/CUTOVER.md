# Cutting over from the Rust server to the Go server

Both servers speak the same HTTP contract, read the same PostgreSQL schema, and
serve the same `storage/` layout, so the cutover is a container swap plus one
bookkeeping step. No schema change and no data migration are involved.

## What was verified before writing this

- The full endpoint contract: 78 endpoints, every one driven with four
  credential classes (312 requests, 0 violations).
- Real-PostgreSQL behaviour on a clone of production: zero migrations re-applied
  across repeated boots; memos, diaries, resources, bots, stats and sync all
  round-trip.
- The built image: boots, answers `/health`, serves the admin UI and its SPA
  fallback, carries ffmpeg, and applies zero migrations.
- A **real-provider smoke test** on a production clone using the owner's own
  configuration (`moonshotai/kimi-k2.6` for chat, `qwen/qwen3-embedding-8b` for
  embeddings): a real memo produced a real 4096-dimension embedding, real tags,
  a real Chinese summary and a real bot reply; a real search ranked that memo
  first as a hybrid match; a real clip returned the model's title, summary, tags
  and refined body.

## Preconditions

- The Go image is built and pushed. The CI workflow defaults to
  `server-go/Dockerfile`; pass `server: rust` to build the old image instead.
- **Pin the Rust image tag you are replacing**, e.g.
  `docker tag ghcr.io/.../mosaic-server:latest ghcr.io/.../mosaic-server:pre-go`
  and push it. That tag is the rollback.
- `JWT_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` and `STORAGE_TYPE` are
  already in the deployment's `.env`; the Go server reads the same names.

## Cutover

```bash
cd ~/mosaic

# 1. Stop the Rust server. It is the only writer during normal operation.
docker compose stop mosaic-server

# 2. Record the bookkeeping you are about to hand over.
docker exec mosaic-postgres psql -U mosaic_user -d mosaic -c \
  "SELECT count(*) AS applied FROM _sqlx_migrations WHERE success;"
# Expect 37. Note the number; it must not change afterwards.

# 3. Record the migration history into goose's table. Run this ONCE, while
#    nothing else is writing. It never executes migration SQL.
docker run --rm --network mosaic_default \
  -e DATABASE_URL="postgres://mosaic_user:${POSTGRES_PASSWORD}@postgres:5432/mosaic" \
  -e JWT_SECRET="$JWT_SECRET" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  --entrypoint baseline-sqlx ghcr.io/.../mosaic-server:latest
# Expect: appliedInPreviousServer=37 newlyRecorded=37

# 4. Start the Go server. It applies zero migrations.
docker compose up -d mosaic-server

# 5. Verify.
curl -s localhost:8080/health                      # {"status":"ok","version":...}
docker logs mosaic-server | grep -c '"msg":"migration applied"'   # must be 0
```

## Verification immediately after

- `/health` answers, and a login returns a token whose claims verify.
- `GET /api/memos?pageSize=5` returns the real backlog.
- `GET /api/memos/search?query=<a word you know is in a memo>` returns
  `semanticEnabled: true` and ranks that memo first.
- `GET /admin/` serves the admin UI.
- The mobile app syncs without a full re-download: send a `POST /api/sync/pull`
  with the cursors a client already holds and confirm it returns only changes.

## Rollback

The Rust server can be restarted at any time. Its migrations are byte-identical,
so its SHA-384 checksums still match `_sqlx_migrations`; the extra
`goose_db_version` table is inert.

```bash
docker compose stop mosaic-server
docker tag ghcr.io/.../mosaic-server:pre-go ghcr.io/.../mosaic-server:latest
docker compose up -d mosaic-server
```

Data written by the Go server is ordinary rows in the same schema, so the Rust
server reads it without conversion. The one thing rollback does not undo is a
user's password if it was changed during the window — the hash format is the
same, so it stays valid either way.

## Differences worth watching after cutover

- **The AI diary sweeper runs every 60 seconds** and can write diary entries
  with no request involved. Watch the first few entries it produces.
- **Every memo write now fans out to the provider** (embedding, and where
  enabled auto-tag, auto-summary and bot replies). This matches the Rust
  server's behaviour, but the call volume is worth watching for rate limits.
- **Semantic search degrades honestly**: a very short query may be answered by
  the keyword leg alone. `semanticEnabled` reports whether an embedding was
  produced, not whether it was decisive.
- **`threadCount` and `latestReplyId` describe the `(memo, bot, revision)`
  thread**, not the node's own subtree — matching the Rust server.
- `/admin/static/index.html` answers 301 to the directory, which Go's file
  server does and browsers follow. `/admin/` and deep links serve the SPA
  directly.

## Known gaps, unchanged by cutover

Semantic and hybrid search exist, but the *memory* paths still fall back to
recency when a memo has no embedding. `docs/server-api.md` remains incomplete
relative to the served contract. The admin UI is served as built and was not
rewritten.
