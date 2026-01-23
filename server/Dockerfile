FROM rust:1.78-bookworm AS backend-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY server/Cargo.toml ./
COPY server/Cargo.lock ./

RUN mkdir -p src && echo "fn main() {}" > src/main.rs

RUN cargo fetch
RUN cargo build --release --package server

COPY server/src ./src
COPY server/migrations ./migrations
COPY server/Cargo.toml ./server/Cargo.toml

RUN cd server && cargo build --release

FROM node:20-alpine AS frontend-builder

WORKDIR /app

RUN apk add --no-cache curl bash
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH

COPY server/mosaic-dashboard ./

RUN bun install
RUN bun run build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash appuser

WORKDIR /app

COPY --from=backend-builder /app/target/release/server /usr/local/bin/

COPY --from=frontend-builder /app/dist /app/dist

RUN mkdir -p storage/uploads storage/temp logs

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["server"]
