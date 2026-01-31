# Mosaic Mobile 云端架构迁移开发计划

## 概述

将 Mosaic Mobile 应用从本地 SQLite 架构迁移到纯云端架构，与 Server 和 Desktop 保持一致。

## 当前架构

```
mobile/
├── lib/database/          # SQLite 数据库层 (将删除)
│   ├── connection-manager.ts
│   ├── database-manager.ts
│   ├── query-executor.ts
│   ├── state-manager.ts
│   └── errors.ts
├── lib/services/          # 本地服务层 (将重构)
│   ├── memo-service.ts
│   ├── resource-service.ts
│   └── stats-service.ts
├── migrations/            # SQLite 迁移 (将删除)
│   ├── v1.ts
│   ├── v2.ts
│   └── v3.ts
└── stores/                # 状态管理 (将扩展)
    └── theme-store.ts
```

## 目标架构

```
mobile/
├── lib/api/               # API 客户端层 (新增)
│   ├── client.ts          # 基础 HTTP 客户端
│   ├── auth.ts            # 认证 API
│   ├── memos.ts           # Memo API
│   ├── diaries.ts         # 日记 API
│   ├── resources.ts       # 资源 API
│   ├── stats.ts           # 统计 API
│   └── types.ts           # API 类型定义
├── lib/services/          # 业务逻辑层 (重构)
│   └── token-storage.ts   # 令牌安全存储
├── stores/                # 状态管理 (扩展)
│   ├── auth-store.ts      # 认证状态
│   └── theme-store.ts
├── app/
│   ├── setup.tsx          # 设置向导页面 (新增)
│   └── _layout.tsx        # 根布局 (修改)
└── types/                 # 类型定义 (扩展)
    └── api.ts             # API 相关类型
```

---

## 开发任务清单

### 阶段一：基础设施 (第1-2天)

#### 1.1 创建 API 类型定义

**文件**: `mobile/types/api.ts`

```typescript
// API 响应类型
export interface ApiResponse<T> {
  data: T
  error?: string
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 认证相关
export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse extends AuthTokens {
  user: User
}

export interface ServerConfig {
  url: string
  username: string
  password: string
}
```

#### 1.2 创建 API 客户端

**文件**: `mobile/lib/api/client.ts`

核心功能:

- 基础 fetch 封装
- 自动添加 Authorization header
- 401 时自动刷新 token 并重试
- 请求超时处理 (30秒)
- 错误类型化处理

#### 1.3 创建令牌存储服务

**文件**: `mobile/lib/services/token-storage.ts`

使用 `expo-secure-store` 安全存储:

- Access Token
- Refresh Token
- Server URL
- Username

#### 1.4 创建认证状态管理

**文件**: `mobile/stores/auth-store.ts`

状态:

```typescript
interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  serverUrl: string | null
  error: string | null
}
```

方法:

- `login(url, username, password)`
- `logout()`
- `refreshToken()`
- `checkAuth()`

---

### 阶段二：API 层实现 (第2-3天)

#### 2.1 认证 API

**文件**: `mobile/lib/api/auth.ts`

| 方法                        | 端点                             | 描述         |
| --------------------------- | -------------------------------- | ------------ |
| `login(username, password)` | `POST /api/auth/login`           | 用户登录     |
| `refresh(refreshToken)`     | `POST /api/auth/refresh`         | 刷新令牌     |
| `me()`                      | `GET /api/auth/me`               | 获取当前用户 |
| `changePassword(old, new)`  | `POST /api/auth/change-password` | 修改密码     |
| `updateProfile(data)`       | `PUT /api/auth/update`           | 更新资料     |
| `updateAvatar(avatarUrl)`   | `POST /api/auth/update-avatar`   | 更新头像     |

#### 2.2 Memo API

**文件**: `mobile/lib/api/memos.ts`

| 方法               | 端点                           | 描述           |
| ------------------ | ------------------------------ | -------------- |
| `list(params)`     | `GET /api/memos`               | 获取 memo 列表 |
| `get(id)`          | `GET /api/memos/:id`           | 获取单个 memo  |
| `getByDate(date)`  | `GET /api/memos/date/:date`    | 按日期获取     |
| `create(data)`     | `POST /api/memos`              | 创建 memo      |
| `update(id, data)` | `PUT /api/memos/:id`           | 更新 memo      |
| `delete(id)`       | `DELETE /api/memos/:id`        | 删除 memo      |
| `archive(id)`      | `PUT /api/memos/:id/archive`   | 归档 memo      |
| `unarchive(id)`    | `PUT /api/memos/:id/unarchive` | 取消归档       |
| `search(params)`   | `GET /api/memos/search`        | 搜索 memo      |

#### 2.3 日记 API

**文件**: `mobile/lib/api/diaries.ts`

| 方法                           | 端点                             | 描述          |
| ------------------------------ | -------------------------------- | ------------- |
| `list(params)`                 | `GET /api/diaries`               | 获取日记列表  |
| `get(date)`                    | `GET /api/diaries/:date`         | 获取单日日记  |
| `create(date, data)`           | `POST /api/diaries/:date`        | 创建/更新日记 |
| `update(date, data)`           | `PUT /api/diaries/:date`         | 更新日记      |
| `updateSummary(date, summary)` | `PUT /api/diaries/:date/summary` | 更新摘要      |
| `updateMood(date, mood)`       | `PUT /api/diaries/:date/mood`    | 更新心情      |

#### 2.4 资源 API

**文件**: `mobile/lib/api/resources.ts`

| 方法                     | 端点                                   | 描述         |
| ------------------------ | -------------------------------------- | ------------ |
| `list(params)`           | `GET /api/resources`                   | 获取资源列表 |
| `get(id)`                | `GET /api/resources/:id`               | 获取资源信息 |
| `upload(file, memoId)`   | `POST /api/resources/upload`           | 上传文件     |
| `uploadAvatar(file)`     | `POST /api/resources/upload-avatar`    | 上传头像     |
| `delete(id)`             | `DELETE /api/resources/:id`            | 删除资源     |
| `download(id)`           | `GET /api/resources/:id/download`      | 下载资源     |
| `getAvatarUrl(filename)` | `GET /api/resources/avatars/:filename` | 获取头像 URL |

#### 2.5 统计 API

**文件**: `mobile/lib/api/stats.ts`

| 方法                      | 端点                      | 描述           |
| ------------------------- | ------------------------- | -------------- |
| `getHeatmap(start, end)`  | `GET /api/stats/heatmap`  | 获取热力图数据 |
| `getTimeline(start, end)` | `GET /api/stats/timeline` | 获取时间线数据 |
| `getTrends(start, end)`   | `GET /api/stats/trends`   | 获取趋势数据   |
| `getSummary(year, month)` | `GET /api/stats/summary`  | 获取月度摘要   |

---

### 阶段三：页面实现 (第3-4天)

#### 3.1 设置向导页面

**文件**: `mobile/app/setup.tsx`

参考: `desktop/src/pages/desktop/SetupWizard.tsx`

功能:

- 服务器地址输入
- 用户名/密码输入
- 连接测试
- 登录并保存配置
- 跳转到主页

UI 组件:

- Logo 展示
- 表单输入 (Input)
- 测试连接按钮
- 开始使用按钮
- 加载状态
- 错误提示

#### 3.2 修改根布局

**文件**: `mobile/app/_layout.tsx`

修改内容:

- 移除数据库初始化逻辑
- 添加认证状态检查
- 未认证时显示设置向导
- 已认证时显示主界面

---

### 阶段四：组件重构 (第4-5天)

#### 4.1 需要重构的组件

| 组件             | 文件                                     | 修改内容              |
| ---------------- | ---------------------------------------- | --------------------- |
| MemoList         | `components/memo/MemoList.tsx`           | 使用 API 替代本地查询 |
| MemoCard         | `components/memo/MemoCard.tsx`           | 更新资源 URL 处理     |
| MemoInput        | `components/editor/MemoInput.tsx`        | 使用 API 创建 memo    |
| FullScreenEditor | `components/editor/FullScreenEditor.tsx` | 使用 API 创建/更新    |
| ResourceGallery  | `components/archive/ResourceGallery.tsx` | 使用 API 获取资源     |
| MoodHeatMap      | `components/archive/MoodHeatMap.tsx`     | 使用 API 获取数据     |
| CalendarPicker   | `components/archive/CalendarPicker.tsx`  | 使用 API 获取日期数据 |

#### 4.2 添加加载和错误状态

所有数据组件需要:

- Loading 状态显示
- 错误状态处理
- 重试机制
- 空状态提示

---

### 阶段五：清理工作 (第5天)

#### 5.1 删除文件

```
mobile/lib/database/           # 整个目录
  ├── connection-manager.ts
  ├── database-manager.ts
  ├── query-executor.ts
  ├── state-manager.ts
  ├── errors.ts
  ├── logger.ts
  └── types.ts

mobile/migrations/             # 整个目录
  ├── index.ts
  ├── v1.ts
  ├── v2.ts
  └── v3.ts
```

#### 5.2 更新依赖

从 `package.json` 移除:

```json
"expo-sqlite": "^16.0.10"
```

添加:

```json
"expo-secure-store": "~15.0.0"
```

#### 5.3 更新类型

- 删除 `MemoRow` (数据库行类型)
- 更新 `Resource` 添加 `url` 字段
- 更新 `User` 移除本地路径字段

---

## 文件创建清单

### 新增文件

| 文件路径                        | 用途         |
| ------------------------------- | ------------ |
| `types/api.ts`                  | API 类型定义 |
| `lib/api/client.ts`             | HTTP 客户端  |
| `lib/api/auth.ts`               | 认证 API     |
| `lib/api/memos.ts`              | Memo API     |
| `lib/api/diaries.ts`            | 日记 API     |
| `lib/api/resources.ts`          | 资源 API     |
| `lib/api/stats.ts`              | 统计 API     |
| `lib/api/index.ts`              | API 导出     |
| `lib/services/token-storage.ts` | 令牌存储     |
| `stores/auth-store.ts`          | 认证状态     |
| `app/setup.tsx`                 | 设置向导     |
| `components/ui/Input.tsx`       | 输入组件     |

### 修改文件

| 文件路径                          | 修改内容      |
| --------------------------------- | ------------- |
| `app/_layout.tsx`                 | 认证检查逻辑  |
| `types/index.ts`                  | 导出新类型    |
| `types/resource.ts`               | 添加 url 字段 |
| `package.json`                    | 更新依赖      |
| `components/memo/MemoList.tsx`    | 使用 API      |
| `components/editor/MemoInput.tsx` | 使用 API      |
| `app/(tabs)/index.tsx`            | 使用 API      |
| `app/(tabs)/archive.tsx`          | 使用 API      |

### 删除文件

| 文件路径                           |
| ---------------------------------- |
| `lib/database/*` (整个目录)        |
| `migrations/*` (整个目录)          |
| `lib/services/memo-service.ts`     |
| `lib/services/resource-service.ts` |
| `lib/services/stats-service.ts`    |

---

## API 端点完整列表

### 认证 `/api/auth`

```
POST   /api/auth/login           # 登录
POST   /api/auth/refresh         # 刷新令牌
GET    /api/auth/me              # 获取当前用户
POST   /api/auth/change-password # 修改密码
PUT    /api/auth/update          # 更新资料
POST   /api/auth/update-avatar   # 更新头像
```

### Memo `/api/memos`

```
GET    /api/memos                # 列表 (分页)
POST   /api/memos                # 创建
GET    /api/memos/search         # 搜索
GET    /api/memos/date/:date     # 按日期获取
GET    /api/memos/:id            # 获取单个
PUT    /api/memos/:id            # 更新
DELETE /api/memos/:id            # 删除
PUT    /api/memos/:id/archive    # 归档
PUT    /api/memos/:id/unarchive  # 取消归档
```

### 日记 `/api/diaries`

```
GET    /api/diaries              # 列表 (分页)
GET    /api/diaries/:date        # 获取单日
POST   /api/diaries/:date        # 创建/更新
PUT    /api/diaries/:date        # 更新
PUT    /api/diaries/:date/summary # 更新摘要
PUT    /api/diaries/:date/mood   # 更新心情
```

### 资源 `/api/resources`

```
GET    /api/resources                  # 列表 (分页)
POST   /api/resources/upload           # 上传文件
POST   /api/resources/presigned-upload # 预签名上传
POST   /api/resources/confirm-upload   # 确认上传
POST   /api/resources/upload-avatar    # 上传头像
GET    /api/resources/:id              # 获取信息
DELETE /api/resources/:id              # 删除
GET    /api/resources/:id/download     # 下载
GET    /api/resources/avatars/:filename # 获取头像 (公开)
```

### 统计 `/api/stats`

```
GET    /api/stats/heatmap        # 热力图
GET    /api/stats/timeline       # 时间线
GET    /api/stats/trends         # 趋势
GET    /api/stats/summary        # 月度摘要
```

### 健康检查

```
GET    /health                   # 服务器状态
```

---

## 数据类型对照

### Memo

| 本地类型         | API 类型      | 变更                    |
| ---------------- | ------------- | ----------------------- |
| `MemoRow`        | -             | 删除 (数据库专用)       |
| `Memo.createdAt` | `number` (秒) | 单位从毫秒改为秒        |
| `Memo.isDeleted` | -             | 删除 (软删除由后端处理) |

### Resource

| 本地类型   | API 类型           | 变更                      |
| ---------- | ------------------ | ------------------------- |
| `Resource` | `ResourceResponse` | 添加 `url`, `storageType` |
| 本地路径   | 云端 URL           | 完全使用 URL              |

### User

| 本地类型          | API 类型         | 变更            |
| ----------------- | ---------------- | --------------- |
| `User.avatarPath` | -                | 删除 (使用 URL) |
| `User.avatarUrl`  | `string \| null` | 保留            |

---

## 注意事项

1. **时间戳单位**: 服务器返回秒级时间戳，需统一处理
2. **资源 URL**: 所有资源使用服务器返回的完整 URL
3. **错误处理**: 网络错误需要友好提示
4. **令牌刷新**: 自动刷新机制要可靠
5. **离线状态**: 需要检测网络状态并提示用户

---

## 开发顺序

1. ✅ 创建开发计划文档 (当前)
2. 📝 类型定义 (`types/api.ts`)
3. 📝 API 客户端 (`lib/api/client.ts`)
4. 📝 认证 API (`lib/api/auth.ts`)
5. 📝 令牌存储 (`lib/services/token-storage.ts`)
6. 📝 认证状态 (`stores/auth-store.ts`)
7. 📝 设置向导 (`app/setup.tsx`)
8. 📝 根布局修改 (`app/_layout.tsx`)
9. 📝 其他 API 模块
10. 📝 组件重构
11. 📝 删除旧代码
12. 📝 测试和调试
