# 已知问题

> 更新时间：2026-05-28

## 服务端

- 分页已统一为 `page`/`pageSize`（`SearchMemosRequest` 仍使用独立参数，待对齐）

## 移动端

- 离线 SQLite 中 `ai_summary` 字段待补全（已迁移，组件层面待读取实现）
- 图片在某些 Android 设备上加载慢（调查中）

## 跨平台

- iOS 已完成适配测试，待加入 Apple Developer Program
- 自动化测试覆盖率低，缺用例

## 已修复历史

- ✅ 服务端时区已通过 dashboard 配置化（不再硬编码 `Asia/Shanghai`）
- ✅ `vision_enabled` 字段已从数据库、服务端、前端类型中移除（migration: `20260424120003_drop_bot_vision_enabled.sql`）
- ✅ `bot_replies.thinking_content` 字段已添加（migration: `20260424120002_add_bot_reply_thinking.sql`）
- ✅ 服务端 Bot CRUD 已实现（`/api/bots` 完整 CRUD + `/api/memos/{id}/trigger-replies` + 追问）
- ✅ 移动端 Bot CRUD 类型已对齐（无 `visionEnabled`）
- ✅ Memo 修订历史、主题精简、UI/UX 重构已合并（squash merge）
