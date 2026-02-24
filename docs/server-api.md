# Mosaic Server API 文档

## 1. 基础信息

- Base URL（本地默认）：`http://localhost:8080`
- 健康检查：`GET /health`
- 业务接口前缀：`/api`
- 认证接口前缀：`/api/auth`
- Content-Type：
  - JSON 接口使用 `application/json`
  - 文件上传使用 `multipart/form-data`

## 2. 认证与鉴权

### 2.1 鉴权方式

除 `GET /health`、`POST /api/auth/login`、`POST /api/auth/refresh` 外，其余接口均需携带：

```http
Authorization: Bearer <access_token>
```

### 2.2 Token 生命周期

- Access Token：24 小时
- Refresh Token：7 天

### 2.3 常见认证错误

- `401 Unauthorized`
- `401 Invalid token`

## 3. 全局约定

### 3.1 命名风格

- JSON 字段主要采用 `camelCase`
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

> 注：少量路由存在直接返回字符串或自定义 JSON 的 `BadRequest`（例如日期格式错误），联调时请按接口定义单独处理。

---

## 5. 健康检查

### GET /health

无需鉴权。

响应示例：

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## 6. Auth 模块

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

刷新 token。

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

返回更新后的 `user`。

### 6.6 POST /api/auth/update-avatar

通过头像 URL 更新当前用户头像。

请求体：

```json
{
  "avatarUrl": "/api/avatars/{id}/download"
}
```

返回更新后的 `user`。

---

## 7. Memo 模块

### 7.1 POST /api/memos

创建 memo。

请求体：

```json
{
  "content": "今天完成了接口联调",
  "tags": ["work", "api"],
  "diaryDate": "2026-02-24",
  "resourceIds": ["resource-uuid"]
}
```

### 7.2 GET /api/memos

分页查询 memo。

Query：

- `page` (optional)
- `pageSize` (optional)
- `archived` (optional)
- `diaryDate` (optional, YYYY-MM-DD)
- `search` (optional)

返回：`PaginatedResponse<MemoWithResources>`

### 7.3 GET /api/memos/{id}

按 ID 获取 memo。

### 7.4 PUT /api/memos/{id}

更新 memo。

请求体（字段可选）：

```json
{
  "content": "更新后的内容",
  "tags": ["edited"],
  "resourceIds": ["resource-uuid"],
  "isArchived": false,
  "diaryDate": "2026-02-24"
}
```

### 7.5 DELETE /api/memos/{id}

删除 memo。

成功返回：`200`（空 body）

### 7.6 PUT /api/memos/{id}/archive

归档 memo。

请求体：

```json
{
  "diaryDate": "2026-02-24"
}
```

> `diaryDate` 可选。

### 7.7 PUT /api/memos/{id}/unarchive

取消归档。

成功返回：`200`（空 body）

### 7.8 GET /api/memos/date/{date}

按创建日期获取 memo 列表。

- `date`：`YYYY-MM-DD`
- Query：`archived`（可选）

### 7.9 GET /api/memos/search

搜索 memo。

Query：

- `query` (required)
- `tags` 或 `tags[]` (optional)
- `startDate` (optional, string)
- `endDate` (optional, string)
- `isArchived` (optional)
- `page` (optional, 默认 1)
- `pageSize` (optional, 默认 50)

返回：`PaginatedResponse<MemoWithResources>`

### 7.10 GET /api/memos/tags

获取用户全部标签及计数。

---

## 8. Diary 模块

### 8.1 GET /api/diaries

分页查询日记。

Query：

- `page` (optional)
- `pageSize` (optional)
- `startDate` (optional)
- `endDate` (optional)

返回：`PaginatedResponse<DiaryResponse>`

### 8.2 GET /api/diaries/{date}

获取某天日记及其 memos。

- `date`：`YYYY-MM-DD`

返回：`DiaryWithMemosResponse`

### 8.3 POST /api/diaries/{date}

创建或覆盖当日日记。

路径中的 `date` 为准（请求体内 `date` 会被服务端覆盖为路径值）。

请求体：

```json
{
  "date": "2026-02-24",
  "summary": "今天状态不错",
  "moodKey": "happy",
  "moodScore": 80,
  "coverImageId": null
}
```

### 8.4 PUT /api/diaries/{date}

部分更新日记。

请求体字段可选：`summary`、`moodKey`、`moodScore`、`coverImageId`

`coverImageId` 支持：

- UUID 字符串（设置封面）
- `null`（清空封面）

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

---

## 9. Resource 模块

### 9.1 GET /api/resources

分页查询资源。

Query：

- `page`（默认 1）
- `pageSize`（默认 100）

响应：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 100
}
```

### 9.2 POST /api/resources/upload

上传资源（`multipart/form-data`）。

表单字段：

- `file`：文件内容
- `memoId`：可选，关联 memo UUID

返回：`ResourceResponse`

### 9.3 POST /api/resources/presigned-upload

创建 R2 预签名直传 URL（仅 `STORAGE_TYPE=r2` 可用）。

请求体：

```json
{
  "memoId": "uuid",
  "filename": "image.png",
  "mimeType": "image/png",
  "fileSize": 12345
}
```

响应体：

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

### 9.5 POST /api/resources/upload-avatar

上传头像（`multipart/form-data`）。

返回：更新后的 `user`。

### 9.6 GET /api/resources/{id}/download

资源下载代理。

### 9.7 GET /api/avatars/{id}/download

头像下载代理（当前返回 `image/jpeg`）。

### 9.8 DELETE /api/resources/{id}

删除资源。

成功返回：`200`（空 body）

---

## 10. Stats 模块

### 10.1 GET /api/stats/heatmap

Query（required）：

- `startDate`（YYYY-MM-DD）
- `endDate`（YYYY-MM-DD）

返回：`HeatMapData`

### 10.2 GET /api/stats/timeline

Query（required）：

- `startDate`
- `endDate`

返回：`TimelineData`

### 10.3 GET /api/stats/trends

Query（required）：

- `startDate`
- `endDate`

返回：`TrendsData`

### 10.4 GET /api/stats/summary

Query（required）：

- `year`（int）
- `month`（int）

返回：`SummaryData`

---

## 11. 关键数据结构（简版）

### 11.1 PaginatedResponse<T>

```json
{
  "items": [],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

### 11.2 MemoWithResources

- `id`: uuid
- `content`: string
- `tags`: string[]
- `isArchived`: bool
- `diaryDate`: string | null
- `createdAt`: number
- `updatedAt`: number
- `resources`: Resource[]

### 11.3 DiaryWithMemosResponse

- `date`: string
- `summary`: string
- `moodKey`: string
- `moodScore`: number
- `coverImageId`: uuid | null
- `createdAt`: number
- `updatedAt`: number
- `memos`: MemoWithResources[]

### 11.4 ResourceResponse

- `id`: uuid
- `memoId`: uuid | null
- `filename`: string
- `resourceType`: `image` | `video`
- `mimeType`: string
- `fileSize`: number
- `storageType`: string
- `url`: string
- `createdAt`: number

---

## 12. 环境变量（接口行为相关）

- `PORT`：服务端口（默认 `8080`）
- `JWT_SECRET`：JWT 签名密钥（必填）
- `STORAGE_TYPE`：`local` / `r2`
- `LOCAL_STORAGE_PATH`：本地存储目录
- `R2_ENDPOINT`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`：R2 配置
- `ADMIN_USERNAME`、`ADMIN_PASSWORD`：启动时自动确保管理员账号存在

---

