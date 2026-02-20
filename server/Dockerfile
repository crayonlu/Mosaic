FROM rust:1.88-bookworm AS backend-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY src ./src
COPY migrations ./migrations
COPY Cargo.toml .
COPY Cargo.lock .

RUN cargo fetch
RUN cargo build --release --package server

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash appuser

WORKDIR /app

COPY --from=backend-builder /app/target/release/server /usr/local/bin/

RUN mkdir -p storage/uploads storage/temp logs
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["server"]
