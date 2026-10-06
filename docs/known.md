# 已知问题

> 更新时间：2026-10-06

## 服务端

- Go 服务端已完成生产切流，当前部署为 `server-v1.1.5`。
- 查询参数与分页默认值按接口区分，兼容拼写见 [API 文档](./server-api.md) 和 [OpenAPI](../server-go/internal/httpapi/openapi.json)。
- 本次新增 `/openapi.json`，部署环境需更新镜像后才可访问。
- 缺少可用查询向量时，语义搜索使用关键词结果；缺少 memo 嵌入时，相关记忆检索会使用近期记录。
- 同步每种实体查询上限为 200 条，返回游标直接推进到服务器时间；积压超限时可能漏拉后续记录，可靠分页仍需修复。

## 移动端

以下历史问题在此次文档更新中尚未复测：

- 离线 SQLite 中 `ai_summary` 字段待补全（已迁移，组件层面待读取实现）
- 图片在某些 Android 设备上加载慢（调查中）

## 跨平台

- iOS 已完成适配测试，待加入 Apple Developer Program
- Go 服务端已有契约、单元和 PostgreSQL 集成测试；本次全量竞态测试通过。移动端自动化覆盖仍需完善。

## 已修复历史

- ✅ 服务端时区已通过 dashboard 配置化（字段为 `appTimezone`）
- ✅ `vision_enabled` 字段已从数据库、服务端、前端类型中移除（migration: `20260424120003_drop_bot_vision_enabled.sql`）
- ✅ `bot_replies.thinking_content` 字段已添加（migration: `20260424120002_add_bot_reply_thinking.sql`）
- ✅ 服务端 Bot CRUD 已实现（`/api/bots` 完整 CRUD + `/api/memos/{id}/trigger-replies` + 追问）
- ✅ 移动端 Bot CRUD 类型已对齐（无 `visionEnabled`）
- ✅ Memo 修订历史、主题精简、UI/UX 重构已合并（squash merge）
