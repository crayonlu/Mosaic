# 文档索引与常用命令

> 更新时间：2026-10-06

## 文档

- [Server API](./server-api.md)
- [OpenAPI 3.1 规范](../server-go/internal/httpapi/openapi.json)：Go 服务端提供公开的 `GET /openapi.json` 和 `HEAD /openapi.json`
- [Go 切流记录](../server-go/CUTOVER.md)
- [发布指南](./release-guide.md)
- [已知问题](./known.md)
- [在线文档源码](../docsite/content/)

## 当前版本

| 项目                      | 版本来源              | 当前版本        |
| ------------------------- | --------------------- | --------------- |
| 根 workspace              | `package.json`        | `1.2.1`         |
| Mobile (`@mosaic/mobile`) | `mobile/package.json` | `1.0.15`        |
| Go 服务端                 | 发布标签              | `server-v1.1.5` |

OpenAPI 契约版本独立于发布标签。此次新增的 `/openapi.json` 入口需发布更新后的 Go 镜像后才能在部署环境使用。健康检查的 `version` 由构建参数注入；未注入时为 `dev`。

## 常用命令

在仓库根目录运行：

```bash
bun install
bun mobile:start
bun mobile:android
bun mobile:ios
bun mobile:web
bun run check                 # lint、typecheck、format:check
bun run lint
bun run typecheck
bun run format:check
bun run format
bun run build
```

Go 服务端独立于 Bun workspace：

```bash
cd server-go
cp .env.example .env          # 根据本地环境填写数据库和密钥
# 启动时自动读取 .env
go run ./cmd/mosaic-server
go test ./...
go test -race ./...
go vet ./...
```

设置 `MOSAIC_TEST_DATABASE_URL` 可运行真实 PostgreSQL 集成测试；测试会创建隔离数据库，连接用户需有创建数据库权限。

管理后台使用共享的 `server/admin-ui/`：

```bash
cd server/admin-ui
bun run dev
```

文档站独立安装依赖和运行：

```bash
cd docsite
npm ci
bun run dev
bun run types:check
bun run build                 # 静态导出，basePath 为 /Mosaic
```
