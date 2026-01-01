# Mosaic Mobile

这是 Mosaic 项目的移动端应用，使用 React Native + Expo 构建。

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm start

# 在特定平台运行
pnpm android      # Android
pnpm ios          # iOS
pnpm web          # Web
```

## 📝 可用脚本

```bash
pnpm start        # 启动 Expo 开发服务器
pnpm android      # 在 Android 上运行
pnpm ios          # 在 iOS 上运行
pnpm web          # 在浏览器中运行
pnpm lint         # ESLint 检查
pnpm lint:fix     # 自动修复 ESLint 问题
pnpm format       # Prettier 格式化
pnpm format:check # 检查代码格式
```

## 📦 技术栈

- **React Native** - 跨平台移动开发框架
- **Expo** - React Native 开发工具链
- **Expo Router** - 基于文件的路由系统
- **TypeScript** - 类型安全

## 📁 项目结构

```
mobile/
├── app/              # 应用页面（Expo Router）
│   ├── index.tsx    # 首页
│   └── _layout.tsx  # 布局
├── assets/          # 静态资源
├── package.json     # 依赖配置
└── app.json         # Expo 配置
```

## 🔧 开发指南

### 添加新页面

在 `app/` 目录下创建新的 `.tsx` 文件，Expo Router 会自动生成路由。

### 代码规范

项目使用 ESLint 和 Prettier 进行代码质量管理：

```bash
# 检查代码
pnpm lint

# 自动修复
pnpm lint:fix && pnpm format
```

## 📚 相关文档

- [Expo 文档](https://docs.expo.dev/)
- [Expo Router 文档](https://docs.expo.dev/router/introduction/)
- [React Native 文档](https://reactnative.dev/)
