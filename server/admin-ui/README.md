# Mosaic Admin Dashboard

Mosaic 服务端的 Web 管理后台，基于 Vite + React 19 + shadcn/ui 构建。

## 访问方式

服务端启动后，浏览器打开 `http://<your-server>:8080/admin` 即可访问。

**默认登录凭据**（请在生产环境修改）：

| 字段 | 默认值 |
|------|--------|
| 用户名 | `admin` |
| 密码 | `admin123` |

通过环境变量 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 配置。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 7 |
| UI | shadcn/ui + Tailwind CSS 4 + Geist 字体 |
| 图标 | Lucide React |
| 路由 | React Router 7 |
| 状态 | Zustand |
| 国际化 | i18next（中 / 英） |
| API | ofetch |

## 项目结构

```
admin-ui/
├── src/
│   ├── api/              # 后端 API 封装（ofetch）
│   ├── components/       # 通用组件
│   │   └── ui/           # shadcn/ui 基础组件
│   ├── hooks/            # 自定义 Hooks
│   ├── layouts/          # 布局组件
│   ├── lib/              # 工具库（i18n 等）
│   ├── locales/          # 国际化翻译文件
│   ├── router/           # 路由配置 + 鉴权守卫
│   ├── stores/           # Zustand 状态仓库
│   └── views/            # 页面视图
│       ├── Dashboard.tsx # 仪表盘首页
│       ├── Bots.tsx      # Bot 管理
│       └── Login.tsx     # 登录页
```

## 路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | 需输入服务端地址和账号密码 |
| `/dashboard` | 仪表盘 | 服务健康状态、统计概览、AI 配置、自动化设置、Bot 管理、Memory 面板 |
| `/bots` | Bot 管理 | 创建 / 编辑 / 删除 AI Bot |

所有页面（除 `/login` 外）均需要登录鉴权，未登录自动跳转至登录页。

## 功能模块

### 健康监控

- 服务端运行状态 / 版本 / 启动时间
- 存储用量 / 数据库大小
- 最近活动日志

### AI 配置

支持配置两个独立的 AI 提供者：

| 配置项 | 用途 | 示例模型 |
|--------|------|---------|
| **Bot Config** | 对话生成、标签、摘要、日记 | GPT-4o, Claude, Ollama |
| **Embedding Config** | 向量嵌入（语义搜索） | text-embedding-3-small, nomic-embed-text |

每个配置支持：Provider（OpenAI / Anthropic）、Base URL、API Key、Model、Temperature、Max Tokens、超时时间。

### 自动化设置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| Auto Tag | 开启 | 创建 Memo 时自动打标签 |
| Auto Summary | 关闭 | 自动生成 AI 摘要 |
| Auto Diary | 开启 | 自动生成每日日记 |
| Min Memos | 2 | 触发自动日记的最少 Memo 数 |
| Min Chars | 150 | 触发自动日记的最少总字符数 |
| 时区 | Asia/Shanghai | 日记日期计算时区 |

### Bot 管理

创建和管理 AI Bot，每个 Bot 可配置：
- 名称 / 头像 / 描述 / 标签
- 自动回复开关
- 排序顺序

### Memory 面板

查看向量嵌入状态，支持手动触发 Backfill 为缺少嵌入的 Memo 生成向量索引。

## 本地开发

```bash
# 安装依赖
cd server/admin-ui && bun install

# 启动开发服务器（默认 127.0.0.1:5173，API 请求代理到服务端）
bun run dev

# 构建生产版本（输出到 server/static/admin/）
bun run build

# 代码检查
bun run lint

# 类型检查
bun run typecheck
```

> 开发时需确保 Mosaic 服务端已在运行，或通过设置 `SERVER_URL` 连接远程服务端。

## 构建产物

生产构建输出到 `server/static/admin/` 目录，由 Rust 服务端通过 Actix Files 直接 serve。构建完成后重启服务端即可生效。
