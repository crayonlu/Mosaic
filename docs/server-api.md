# Mosaic Server API 文档

> 版本：v2.6
> 更新时间：2026-06-06
> 基于 `server/src/routes/`、`server/src/models/`、`server/src/main.rs` 及 `packages/api/src/` 实际实现

## 1. 基础信息

- Base URL（本地默认）：`http://localhost:8080`
- 健康检查：`GET /health`
- 认证接口前缀：`/api/auth`
- 业务接口前缀：`/api`（借由 `configure_*_routes` 注册）
- 管理 API 前缀：`/admin/api`（需要管理员权限）
- Content-Type：
  - JSON 接口使用 `application/json`
  - 文件上传使用 `multipart/form-data`

## 2. 认证与鉴权

### 2.1 鉴权方式

除 `GET /health`、`POST /api/auth/login`、`POST /api/auth/refresh` 外，其余接口均需携带：

```http
Authorization: Bearer <access_token>
```

管理后台 `/admin/api/*` 也需要同样的 Bearer token。

### 2.2 Token 生命周期

- Access Token：24 小时
- Refresh Token：7 天

### 2.3 常见认证错误

- `401 Unauthorized`
- `401 Invalid token`

## 3. 全局约定

### 3.1 命名风格

- JSON 字段采用 `camelCase`（Rust 端使用 `#[serde(rename_all = "camelCase")]`）
- 查询参数统一采用 `camelCase`（如 `startDate`、`pageSize`）

### 3.2 时间与日期

- 日期字符串：`YYYY-MM-DD`
- 时间戳字段（如 `createdAt`、`updatedAt`）为毫秒级 Unix 时间戳

### 3.3 分页默认值

- Memos 列表：`page=1`、`pageSize=20`
- Memos 搜索：`page=1`、`pageSize=50`
- Diaries 列表：`page=1`、`pageSize=20`
- Resources 列表：`page=1`、`pageSize=100`

## 4. 错误响应格式

### 4.1 统一错误结构（AppError）

多数服务错误返回：

```json
{
  "error": "400 Bad Request",
  "message": "Invalid input: ..."
}
```

### 4.2 状态码映射

- `401`：未授权 / Token 无效 / Token 过期
- `404`：用户 / memo / diary / resource 不存在
- `400`：参数不合法
- `500`：数据库、存储或内部错误

---

## 5. 健康检查

### GET /health

无需鉴权，路由直接注册在根 scope。

响应示例：

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## 6. Auth 模块

`/api/auth/**`

### 6.1 POST /api/auth/login

登录。

请求体：

```json
{
  "username": "admin",
  "password": "admin123"
}
```

响应体：

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "avatarUrl": null,
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000
  }
}
```

### 6.2 POST /api/auth/refresh

刷新 token。无需鉴权。

请求体：

```json
{
  "refreshToken": "..."
}
```

响应体：

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

### 6.3 GET /api/auth/me

获取当前用户信息。

响应体：`UserResponse`

### 6.4 POST /api/auth/change-password

修改密码。

请求体：

```json
{
  "oldPassword": "old",
  "newPassword": "new"
}
```

成功返回：`200`（空 body）

### 6.5 PUT /api/auth/update-user

更新用户名和/或头像 URL。

请求体（字段均可选）：

```json
{
  "username": "new-name",
  "avatarUrl": "/api/avatars/{id}/download"
}
```

返回更新后的 `UserResponse`。

### 6.6 POST /api/auth/update-avatar

通过已有头像 URL 更新当前用户头像（非上传，上传请使用 `POST /api/resources/upload-avatar`）。

请求体：

```json
{
  "avatarUrl": "/api/avatars/{id}/download"
}
```

返回更新后的 `UserResponse`。

### 数据结构

#### UserResponse

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| username | string | |
| avatarUrl | string? | 头像下载 URL |
| createdAt | number | 毫秒时间戳 |
| updatedAt | number | 毫秒时间戳 |

---

## 7. Memo 模块

`/api/memos/**`

### 7.1 POST /api/memos

创建 memo。

请求体（`CreateMemoRequest`）：

```json
{
  "content": "今天完成了接口联调",
  "tags": ["work", "api"],
  "diaryDate": "2026-02-24",
  "resourceIds": ["resource-uuid"],
  "aiSummary": "可选的 AI 摘要"
}
```

所有字段除 `content` 外均为可选。

### 7.2 GET /api/memos

分页查询 memo。

Query 参数（`ListMemosQuery`）：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number? | 默认 1 |
| pageSize | number? | 默认 20 |
| archived | boolean? | 筛选归档状态 |
| diaryDate | string (YYYY-MM-DD)? | 按日记日期筛选 |
| search | string? | 全文搜索 |

返回：`PaginatedResponse<MemoWithResources>`

### 7.3 GET /api/memos/{id}

按 ID 获取 memo。

返回：`MemoWithResources`

### 7.4 GET /api/memos/{id}/detail

获取 memo 完整详情（含修订历史和 Bot 回复）。

返回：`MemoDetail`

```json
{
  "memo": { /* MemoWithResources */ },
  "revisions": [ /* MemoRevision[] */ ],
  "botReplies": [ /* BotReplyResponse[] */ ]
}
```

### 7.5 PUT /api/memos/{id}

更新 memo。字段均可选，未提供的字段保持不变；显式传 `null` 可清空某些字段。

请求体（`UpdateMemoRequest`）：

```json
{
  "content": "更新后的内容",
  "tags": ["edited"],
  "resourceIds": ["resource-uuid"],
  "isArchived": false,
  "diaryDate": "2026-02-24",
  "aiSummary": "新的摘要"
}
```

说明：
- `diaryDate` 传 `null` 可清除日记日期绑定
- `aiSummary` 传 `null` 可清除 AI 摘要

### 7.6 DELETE /api/memos/{id}

删除 memo。

成功返回：`200`（空 body）

### 7.7 PUT /api/memos/{id}/archive

归档 memo。

请求体（可选）：

```json
{
  "diaryDate": "2026-02-24"
}
```

> `diaryDate` 可选，归档时同时绑定到指定日记日期。

### 7.8 PUT /api/memos/{id}/unarchive

取消归档。

成功返回：`200`（空 body）

### 7.9 GET /api/memos/date/{date}

按创建日期获取 memo 列表。

- `date`：`YYYY-MM-DD`
- Query：`archived`（可选，boolean）

返回：`MemoWithResources[]`

### 7.10 GET /api/memos/search

搜索 memo（支持关键词 + 向量语义混合搜索）。

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| query | string | **必填**。搜索关键词 |
| tags / tags[] | string? | 可重复，每次传一个值 |
| startDate | string (YYYY-MM-DD)? | 起始日期 |
| endDate | string (YYYY-MM-DD)? | 结束日期 |
| isArchived | boolean? | 是否归档 |
| page | number? | 默认 1 |
| pageSize | number? | 默认 50 |

返回：`SearchMemosResponse`

```json
{
  "memos": [
    {
      "id": "uuid",
      "content": "...",
      "tags": ["tag1"],
      "isArchived": false,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000,
      "revisionCount": 1,
      "aiSummary": "可选的摘要",
      "semanticScore": 0.85,
      "keywordScore": 0.72,
      "matchType": "hybrid"
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 50,
  "semanticEnabled": true
}
```

> 注意：搜索返回的不是 `PaginatedResponse`，而是独立结构体，包含 `semanticEnabled` 字段表示语义搜索是否可用。

### 7.11 GET /api/memos/tags

获取用户全部标签及计数。

返回：`TagResponse[]`

```json
[
  { "tag": "work", "count": 15 },
  { "tag": "api", "count": 3 }
]
```

### 7.12 POST /api/memos/clip

剪辑 web 内容为 memo（调用 AI 解析 URL 或原始文本）。

请求体（`ClipRequest`）：

```json
{
  "clipType": "url",
  "url": "https://example.com/article",
  "content": null,
  "resourceId": null,
  "userNote": "我的备注"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| clipType | "url" \| "text" \| "image" | 必填 |
| url | string? | clipType=url 时需要 |
| content | string? | clipType=text 时需要 |
| resourceId | string? | clipType=image 时需要 |
| userNote | string? | 用户备注，会拼入 AI 提示词 |

返回：`ClipResult`

```json
{
  "title": "页面标题",
  "content": "提取后的正文",
  "aiSummary": "AI 摘要",
  "tags": ["tag1", "tag2"],
  "sourceUrl": "https://example.com/article",
  "sourceType": "url",
  "originalTitle": "原始页面标题"
}
```

### 7.13 GET /api/memos/{id}/revisions

获取 memo 的编辑历史。

返回：`MemoRevision[]`

```json
[
  {
    "id": "revision-uuid",
    "memoId": "memo-uuid",
    "revisionNumber": 1,
    "content": "历史版本内容",
    "tags": ["tag1"],
    "aiSummary": "历史摘要",
    "createdAt": 1700000000000
  }
]
```

### 7.14 DELETE /api/memos/{id}/revisions/{revisionId}

删除指定修订版本。

成功返回：`200`（空 body）

### 数据结构

#### MemoWithResources

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| content | string | |
| tags | string[] | |
| isArchived | boolean | |
| diaryDate | string? | YYYY-MM-DD |
| aiSummary | string? | AI 摘要 |
| createdAt | number | 毫秒时间戳 |
| updatedAt | number | 毫秒时间戳 |
| revisionCount | number | 修订版本数 |
| resources | Resource[] | 关联资源 |

#### Memo（搜索结果中的精简格式）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| content | string | |
| tags | string[] | |
| isArchived | boolean | |
| diaryDate | string? | |
| aiSummary | string? | |
| createdAt | number | |
| updatedAt | number | |
| revisionCount | number | |
| semanticScore | number? | 语义搜索相关性分数 |
| keywordScore | number? | 关键词搜索相关性分数 |
| matchType | "keyword" \| "semantic" \| "hybrid"? | 匹配方式 |

#### MemoDetail

| 字段 | 类型 | 说明 |
|------|------|------|
| memo | MemoWithResources | |
| revisions | MemoRevision[] | |
| botReplies | BotReply[] | Bot 回复列表 |

#### MemoRevision

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| memoId | string (uuid) | |
| revisionNumber | number | 版本号 |
| content | string | |
| tags | string[] | |
| aiSummary | string? | |
| createdAt | number | |

---

## 8. Diary 模块

`/api/diaries/**`

### 8.1 GET /api/diaries

分页查询日记。

Query 参数（`ListDiariesQuery`）：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number? | 默认 1 |
| pageSize | number? | 默认 20 |
| startDate | string (YYYY-MM-DD)? | |
| endDate | string (YYYY-MM-DD)? | |

返回：`PaginatedResponse<DiaryResponse>`

### 8.2 GET /api/diaries/{date}

获取某天日记及其 memos。

- `date`：`YYYY-MM-DD`

返回：`DiaryWithMemosResponse`

### 8.3 POST /api/diaries/{date}

创建或覆盖当日日记。

路径中的 `date` 为准（请求体内 `date` 会被服务端覆盖为路径值）。

请求体（`CreateDiaryRequest`）：

```json
{
  "date": "2026-02-24",
  "summary": "今天状态不错",
  "moodKey": "joy",
  "moodScore": 80
}
```

### 8.4 PUT /api/diaries/{date}

部分更新日记。

请求体（`UpdateDiaryRequest`，字段均可选）：

```json
{
  "summary": "新的摘要",
  "moodKey": "calm",
  "moodScore": 72
}
```

### 8.5 PUT /api/diaries/{date}/summary

仅更新摘要。

请求体：

```json
{
  "summary": "新的摘要"
}
```

### 8.6 PUT /api/diaries/{date}/mood

仅更新心情。

请求体：

```json
{
  "moodKey": "calm",
  "moodScore": 72
}
```

### 数据结构

#### DiaryResponse

| 字段 | 类型 | 说明 |
|------|------|------|
| date | string | YYYY-MM-DD |
| summary | string | |
| moodKey | "joy" \| "calm" \| "neutral" \| "sadness" \| "anxiety" \| "anger" \| "focus" \| "tired" | |
| moodScore | number | 0-100 |
| generationSource | string | 生成来源（"ai" / "manual" 等） |
| autoGenerationLocked | boolean | 自动生成锁定状态 |
| generatedFromMemoIds | string[] | 生成时引用的 memo ID 列表 |
| lastAutoGeneratedAt | number? | 上次自动生成时间 |
| createdAt | number | |
| updatedAt | number | |

#### DiaryWithMemosResponse

继承 `DiaryResponse` 所有字段，另加：

| 字段 | 类型 | 说明 |
|------|------|------|
| memos | MemoWithResources[] | 该日记日期关联的 memo |

#### MoodKey 枚举

```typescript
'joy' | 'calm' | 'neutral' | 'sadness' | 'anxiety' | 'anger' | 'focus' | 'tired'
```

---

## 9. Resource 模块

`/api/resources/**`、`/api/avatars/**`

### 9.1 GET /api/resources

分页查询资源。

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number? | 默认 1 |
| pageSize | number? | 默认 100 |

返回：`PaginatedResponse<ResourceResponse>`

### 9.2 POST /api/resources/upload

上传资源（`multipart/form-data`）。

表单字段：

- `file`：文件内容
- `memoId`：可选，关联 memo UUID

限制：

- 最大文件大小：100MB

返回：`ResourceResponse`

### 9.3 POST /api/resources/presigned-upload

创建 R2 预签名直传 URL（仅 `STORAGE_TYPE=r2` 可用）。

请求体（`CreateResourceRequest`）：

```json
{
  "memoId": "uuid",
  "filename": "image.png",
  "mimeType": "image/png",
  "fileSize": 12345,
  "metadata": { "width": 1920, "height": 1080 }
}
```

响应体（`PresignedUploadResponse`）：

```json
{
  "uploadUrl": "https://...",
  "resourceId": "uuid",
  "storagePath": "resources/{userId}/{resourceId}"
}
```

### 9.4 POST /api/resources/confirm-upload

确认直传完成并获取可访问资源信息。

请求体：

```json
{
  "resourceId": "uuid"
}
```

返回：`ResourceResponse`

### 9.5 POST /api/resources/upload-avatar

上传头像（`multipart/form-data`）。

表单字段：

- `file`：图片文件（最大 10MB）

返回：`UserResponse`（带更新后的 `avatarUrl`）

### 9.6 GET /api/resources/{id}/download

资源下载代理（支持 Range 请求和 ETag 缓存）。

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| variant | "thumb" \| "opt"? | 缩略图或优化后的变体 |

### 9.7 GET /api/resources/{id}/thumbnail

资源缩略图下载代理。

### 9.8 GET /api/avatars/{id}/download

头像下载代理。

### 9.9 DELETE /api/resources/{id}

删除资源。

成功返回：`200`（空 body）

### 数据结构

#### ResourceResponse

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| memoId | string? | 关联 memo |
| filename | string | |
| resourceType | "image" \| "video" | |
| mimeType | string | |
| fileSize | number | 字节 |
| storageType | string | "local" \| "r2" |
| url | string | 可访问的下载 URL |
| thumbnailUrl | string? | 缩略图 URL（处理完成后提供） |
| metadata | object | 元数据（宽高、时长等） |
| createdAt | number | |

---

## 10. Bot 模块

`/api/bots/**`、`/api/memos/{id}/bot-replies`、`/api/bot-replies/{id}/**`

### 10.1 GET /api/bots

列出所有 bot。

返回：`Bot[]`

### 10.2 POST /api/bots

创建 bot。

请求体（`CreateBotRequest`）：

```json
{
  "name": "我的助手",
  "description": "一个友好的助手",
  "tags": ["assistant", "friendly"],
  "autoReply": true,
  "avatarUrl": null,
  "model": null,
  "aiConfig": {}
}
```

- `autoReply` 默认为 `true`
- `model` 可选，为空则使用 AI config 默认模型
- `avatarUrl` 可选

返回：`Bot`

### 10.3 GET /api/bots/{id}

获取单个 bot。

返回：`Bot`

### 10.4 PUT /api/bots/{id}

更新 bot。字段均可选。

请求体（`UpdateBotRequest`）：

```json
{
  "name": "新名称",
  "description": "新描述",
  "tags": ["new-tag"],
  "autoReply": false,
  "sortOrder": 1,
  "avatarUrl": null,
  "model": null,
  "aiConfig": {}
}
```

- 传 `null` 可清空 `avatarUrl`、`model`、`aiConfig`

返回：`Bot`

### 10.5 DELETE /api/bots/{id}

删除 bot。

成功返回：`200`（空 body）

### 10.6 PUT /api/bots/reorder

排序 bot。

请求体：

```json
{
  "order": ["bot-uuid-1", "bot-uuid-2", "bot-uuid-3"]
}
```

### 10.7 GET /api/memos/{id}/bot-replies

获取某 memo 的所有 Bot 回复。

返回：`BotReply[]`

每条 BotReply 含 `children`（嵌套回复树）和 `threadCount`（线程总回复数）。

### 10.8 GET /api/bot-replies/{id}/thread

获取 Bot 回复线程完整对话。

- `id` 可以是该线程内任意一条 Bot 回复 ID

返回：`BotThread`

```json
{
  "memoId": "memo-uuid",
  "bot": {
    "id": "bot-uuid",
    "name": "助手名称",
    "avatarUrl": null
  },
  "messages": [
    {
      "id": "msg-uuid",
      "role": "assistant",
      "content": "回复内容",
      "thinkingContent": "思考过程（如有）",
      "resourceIds": [],
      "createdAt": 1700000000000
    },
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "追问内容",
      "resourceIds": ["img-uuid"],
      "createdAt": 1700000000000
    }
  ],
  "latestReplyId": "latest-reply-uuid"
}
```

### 10.9 POST /api/memos/{id}/trigger-replies

手动触发 Bot 对此 memo 自动回复。

成功返回：`200`

### 10.10 POST /api/bot-replies/{id}/reply

对 Bot 回复进行追问（或首次对话）。

请求体（`ReplyToBotRequest`）：

```json
{
  "question": "能详细说说吗？",
  "resourceIds": ["img-uuid"]
}
```

- `resourceIds` 可选，用于传入图片等资源

### 数据结构

#### Bot

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| name | string | |
| avatarUrl | string? | |
| description | string | |
| tags | string[] | |
| autoReply | boolean | 是否自动回复匹配的 memo |
| sortOrder | number | 排序序号 |
| model | string? | 使用的模型名（覆盖 AI config 默认） |
| aiConfig | object? | 自定义 AI 配置参数 |
| createdAt | number | |
| updatedAt | number | |
| memoryStats | BotMemoryStats? | |

#### BotMemoryStats

| 字段 | 类型 | 说明 |
|------|------|------|
| totalContextsBuilt | number | 已构建的上下文数 |
| lastContextAt | number? | 上次构建时间 |

#### BotReply

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| memoId | string (uuid) | |
| bot | BotSummary | 摘要信息 |
| content | string | 回复内容 |
| thinkingContent | string? | AI 思考过程 |
| parentReplyId | string? | 父回复 ID（用于构建线程树） |
| userQuestion | string? | 用户的追问原文 |
| revisionNumber | number? | |
| createdAt | number | |
| children | BotReply[] | 子回复（嵌套结构） |
| threadCount | number | 线程总回复数 |
| latestReplyId | string | 线程中最新的回复 ID |

#### BotThreadMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | |
| role | "user" \| "assistant" | |
| content | string | |
| thinkingContent | string? | |
| resourceIds | string[] | 关联的资源 ID |
| createdAt | number | |

#### BotThread

| 字段 | 类型 | 说明 |
|------|------|------|
| memoId | string (uuid) | |
| bot | BotSummary | |
| messages | BotThreadMessage[] | 线性消息列表 |
| latestReplyId | string | |

---

## 11. Memory 模块

`/api/memory/**`、`/api/memos/{id}/memory-contexts`

### 11.1 GET /api/memory/stats

获取向量嵌入统计。

返回：

```json
{
  "totalMemos": 100,
  "indexedMemos": 85
}
```

### 11.2 GET /api/memory/activity

获取内存检索活动日志。

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| limit | number? | 返回条目数，默认 20 |

返回：`MemoryActivityEntry[]`

```json
[
  {
    "id": "log-uuid",
    "botId": "bot-uuid",
    "botName": "助手名",
    "memoId": "memo-uuid",
    "retrievedCount": 5,
    "promptSize": 1234,
    "createdAt": 1700000000000
  }
]
```

### 11.3 GET /api/memory/context

获取指定 memo+bot 的内存上下文（调试用）。

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| memoId | string (uuid) | **必填** |
| botId | string (uuid) | **必填** |
| limit | number? | 限制返回的上下文条数 |

返回：

```json
{
  "retrievedMemos": [
    {
      "id": "memo-uuid",
      "excerpt": "摘要或截取的内容",
      "score": 0.85,
      "reason": "recent",
      "createdAt": 1700000000000
    }
  ]
}
```

### 11.4 GET /api/memos/{id}/memory-contexts

获取某 memo 所有相关联 Bot 的合并上下文。

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| limit | number? | 每个 Bot 的上下文条数限制 |

返回：

```json
{
  "contexts": {
    "bot-uuid-1": {
      "retrievedMemos": [ /* RetrievedMemoItem[] */ ]
    },
    "bot-uuid-2": {
      "retrievedMemos": [ /* RetrievedMemoItem[] */ ]
    }
  }
}
```

---

## 12. Sync 模块

`/api/sync/pull`

### 12.1 POST /api/sync/pull

拉取数据变更（基于游标的时间戳同步）。

请求体：

```json
{
  "clientId": "device-unique-id",
  "cursors": {
    "memo": 1700000000000,
    "diary": 1700000000000,
    "resource": 1700000000000,
    "bot": 1700000000000
  }
}
```

`cursors` 以 `updatedAt` 毫秒时间戳为游标，传入已同步到的位置。空对象 `{}` 表示全量拉取。

响应体：

```json
{
  "cursors": {
    "memo": 1700000005000,
    "diary": 1700000005000
  },
  "changes": {
    "memo": {
      "updated": [ /* JSON 对象数组 */ ],
      "deletedIds": ["deleted-uuid"]
    },
    "diary": { "updated": [], "deletedIds": [] },
    "resource": { "updated": [], "deletedIds": [] },
    "bot": { "updated": [], "deletedIds": [] }
  }
}
```

> 每次 pull 每种实体最多返回 200 条变更。需更新游标后继续 pull。

---

## 13. Stats 模块

`/api/stats/**`

### 13.1 GET /api/stats/heatmap

获取热力图数据。

Query 参数（必填）：

| 参数 | 类型 | 说明 |
|------|------|------|
| startDate | string (YYYY-MM-DD) | |
| endDate | string (YYYY-MM-DD) | |

返回：

```json
{
  "dates": ["2026-01-01", "2026-01-02"],
  "counts": [5, 3],
  "moods": ["joy", null],
  "moodScores": [80, null]
}
```

### 13.2 GET /api/stats/timeline

获取时间线数据。

Query 参数同上。

返回：

```json
{
  "entries": [
    {
      "date": "2026-01-01",
      "moodKey": "joy",
      "moodScore": 80,
      "summary": "日记摘要",
      "memoCount": 5,
      "color": "#ffcc00"
    }
  ]
}
```

### 13.3 GET /api/stats/trends

获取趋势数据。

Query 参数同上。

返回：

```json
{
  "moods": [
    { "moodKey": "joy", "count": 10, "percentage": 0.4 }
  ],
  "tags": [
    { "tag": "work", "count": 20 }
  ]
}
```

### 13.4 GET /api/stats/summary

获取月度摘要。

Query 参数（必填）：

| 参数 | 类型 | 说明 |
|------|------|------|
| year | number | |
| month | number | 1-12 |

返回：

```json
{
  "totalMemos": 50,
  "totalDiaries": 20,
  "totalResources": 100
}
```

---

## 14. AI 模块

`/api/ai/**`

### 14.1 POST /api/ai/summarize

AI 摘要生成。

请求体：

```json
{
  "content": "需要摘要的长文本"
}
```

响应：

```json
{
  "summary": "生成的摘要"
}
```

### 14.2 POST /api/ai/suggest-tags

AI 标签推荐。

请求体：

```json
{
  "content": "需要打标签的内容",
  "existingTags": ["已有的标签"]
}
```

`existingTags` 可选，已标注的标签将作为 AI 参考。

响应：

```json
{
  "tags": ["推荐标签1", "推荐标签2"]
}
```

---

## 15. Admin 管理 API

`/admin/api/**`

需要管理员权限（通过 Bearer token 鉴权）。

### 15.1 GET /admin/api/health

管理后台健康检查。

返回：

```json
{
  "uptime": "1h 23m",
  "startedAt": 1700000000000,
  "version": "0.1.0",
  "storageType": "local",
  "storageUsed": 12345678,
  "storageUsedFormatted": "11.8 MB",
  "dbSize": 9876543,
  "dbSizeFormatted": "9.4 MB"
}
```

### 15.2 GET /admin/api/stats

获取管理统计数据。

### 15.3 GET /admin/api/activity

管理员活动日志。

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| limit | number? | 默认 100 |

### 15.4 GET /admin/api/config

获取服务配置（安全信息脱敏）。

```json
{
  "port": 8080,
  "storageType": "local"
}
```

### 15.5 GET /admin/api/ai-config

获取 AI 配置（bot + embedding 两个配置键）。

```json
{
  "bot": {
    "key": "bot",
    "provider": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "timeoutSeconds": 30,
    "supportsVision": true,
    "supportsThinking": false,
    "embeddingDim": null,
    "updatedAt": 1700000000000
  },
  "embedding": {
    "key": "embedding",
    "provider": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "text-embedding-3-small",
    "temperature": null,
    "maxTokens": null,
    "timeoutSeconds": null,
    "supportsVision": false,
    "supportsThinking": false,
    "embeddingDim": 1536,
    "updatedAt": 1700000000000
  }
}
```

### 15.6 PUT /admin/api/ai-config/{key}

更新 AI 配置。`{key}` 为 `bot` 或 `embedding`。

请求体（`ServerAiConfigPayload`）：

```json
{
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "timeoutSeconds": 30,
  "supportsVision": true,
  "supportsThinking": false,
  "embeddingDim": null
}
```

### 15.7 POST /admin/api/clear-cache

清除缓存。

```json
{ "message": "Cache cleared" }
```

### 15.8 POST /admin/api/backfill-memory

回填向量嵌入（为尚未嵌入的 memo 生成 embedding）。

```json
{ "message": "Backfill completed" }
```

### 15.9 GET /admin/api/settings

获取应用设置。

```json
{
  "autoTagEnabled": true,
  "autoSummaryEnabled": false,
  "autoDiaryEnabled": true,
  "autoDiaryMinMemos": 2,
  "autoDiaryMinChars": 150,
  "appTimeZone": "Asia/Shanghai"
}
```

### 15.10 PUT /admin/api/settings

更新应用设置。

请求体同 `GET /admin/api/settings` 返回格式。

校验规则：
- `autoDiaryMinMemos` >= 1
- `autoDiaryMinChars` >= 1
- `appTimeZone` 必须为合法 IANA 时区（如 `Asia/Shanghai`、`America/New_York`）

---

## 16. 关键数据结构

### 16.1 PaginatedResponse\<T\>

```json
{
  "items": [],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

### 16.2 ApiError

```json
{
  "error": "400 Bad Request",
  "message": "Invalid input: ..."
}
```

---

## 17. AI 图片输入与资源鉴权约定

该约定服务于 Bot 伴侣系统的 AI 评论/追问能力。

### 17.1 客户端传参原则

- AI 评论/追问接口只接收 `resourceIds`，不接收图片下载 URL。
- `resourceIds` 必须是当前用户有权限访问的资源。
- 仅 `resourceType=image` 的资源可进入 AI 视觉输入。
- 视频资源、头像资源暂不作为 AI 评论图片输入。

### 17.2 服务端转交原则

`GET /api/resources/{id}/download` 需要 Bearer 鉴权，AI Provider 不能直接访问该地址。服务端必须先校验资源权限，再通过内部存储层读取图片，并由 Provider Adapter 转换为对应格式：

- Provider 支持 inline image：传 base64 / data URL。
- Provider 支持文件上传：上传到 Provider 后传文件 ID。
- Provider 只支持 URL：生成短时、一次性、不可枚举的临时 URL。

严禁向 AI Provider 发送以下内容：

- `/api/resources/{id}/download` 原始业务 URL
- 用户 `Authorization` Header
- Cookie / Refresh Token
- 内部对象存储路径或长期公开 URL

### 17.3 校验与限制

- 支持 MIME：`image/jpeg`、`image/png`、`image/webp`
- 默认单次最多 4 张图片
- 默认单张最大 10MB
- 超限、无权限、非图片资源返回 `400` 或在异步初始回复中静默忽略

---

## 18. 环境变量（接口行为相关）

- `PORT`：服务端口（默认 `8080`）
- `JWT_SECRET`：JWT 签名密钥（必填）
- `STORAGE_TYPE`：`local` / `r2`
- `LOCAL_STORAGE_PATH`：本地存储目录
- `R2_ENDPOINT`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`：R2 配置
- `ADMIN_USERNAME`、`ADMIN_PASSWORD`：启动时自动确保管理员账号存在
- `HTML2LLM_URL`：网页内容提取服务地址（Clip 功能使用）