# Build the Go server. The build context is the repository root, matching the
# layout the existing Docker workflow already uses.
#
# GOPROXY is a build argument because the module proxy reachable from CI is not
# always the public one; it defaults to the public proxy.
ARG GOPROXY=https://proxy.golang.org,direct

FROM golang:1.27-bookworm AS backend-builder

ARG GOPROXY
ENV GOPROXY=${GOPROXY} \
    CGO_ENABLED=0 \
    GOOS=linux

WORKDIR /src

# Copy the manifests first so the module cache survives source-only changes.
COPY server-go/go.mod server-go/go.sum ./
RUN go mod download

COPY server-go/ ./

# The migrations directory the server reads at startup. It is copied from the
# previous server's tree so both servers apply the identical files.
COPY server/migrations ./migrations

RUN go build -trimpath -ldflags "-s -w" -o /out/mosaic-server ./cmd/mosaic-server \
 && go build -trimpath -ldflags "-s -w" -o /out/baseline-sqlx ./cmd/baseline-sqlx

FROM oven/bun:1 AS admin-ui-builder

WORKDIR /app

COPY package.json bun.lock ./
COPY server/admin-ui/package.json server/admin-ui/tsconfig.json server/admin-ui/tsconfig.app.json server/admin-ui/tsconfig.node.json server/admin-ui/vite.config.ts server/admin-ui/index.html ./server/admin-ui/
COPY server/admin-ui/src ./server/admin-ui/src
COPY server/admin-ui/public ./server/admin-ui/public

RUN node -e "const p=require('./package.json');p.workspaces=p.workspaces.filter(w=>w==='server/admin-ui');require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))"
RUN bun install
WORKDIR /app/server/admin-ui
RUN bunx vite build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash appuser

WORKDIR /app

COPY --from=backend-builder /out/mosaic-server /usr/local/bin/mosaic-server
COPY --from=backend-builder /out/baseline-sqlx /usr/local/bin/baseline-sqlx
COPY --from=backend-builder /src/migrations ./migrations
COPY --from=admin-ui-builder /app/server/static/admin ./static/admin

# Same directories the previous image created, so the compose volume mounts and
# the local storage layout are unchanged.
RUN mkdir -p storage/uploads storage/temp logs \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["mosaic-server"]
