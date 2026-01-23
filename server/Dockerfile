FROM rust:1.78-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml ./
COPY Cargo.lock ./

RUN mkdir -p src && echo "fn main() {}" > src/main.rs

RUN cargo fetch
RUN cargo build --release --workspace

COPY server ./server

RUN cd server && cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash appuser

WORKDIR /app

COPY --from=builder /app/target/release/server /usr/local/bin/

RUN mkdir -p storage/uploads storage/temp logs

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["server"]
