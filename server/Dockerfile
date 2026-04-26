FROM rust:1.88-bookworm AS backend-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY server/src ./src
COPY server/migrations ./migrations
COPY server/Cargo.toml ./Cargo.toml
COPY server/Cargo.lock ./Cargo.lock

RUN cargo fetch
RUN cargo build --release --package server

FROM oven/bun:1 AS admin-ui-builder

WORKDIR /app

COPY package.json bun.lock ./
COPY server/admin-ui/package.json server/admin-ui/tsconfig.json server/admin-ui/tsconfig.app.json server/admin-ui/tsconfig.node.json server/admin-ui/vite.config.ts server/admin-ui/index.html ./server/admin-ui/
COPY server/admin-ui/src ./server/admin-ui/src
COPY server/admin-ui/public ./server/admin-ui/public

RUN node -e "const p=require('./package.json');p.workspaces=p.workspaces.filter(w=>w==='server/admin-ui');require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))"
RUN bun install
RUN bun --filter admin-ui build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libpq5 \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash appuser

WORKDIR /app

COPY --from=backend-builder /app/target/release/server /usr/local/bin/
COPY --from=admin-ui-builder /app/server/static/admin ./static/admin

RUN mkdir -p storage/uploads storage/temp logs
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["server"]
