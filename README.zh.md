# Mosaic📔

[English](./README.md) | 简体中文

> "整合自己散落的碎片"

一款结合笔记与情感可视化的数字第二大脑，帮助你记录思绪、追踪情绪、整合琐碎的生活碎片

---

## 项目来源

我发现即使每天我都有一些让我印象深刻的时刻，但是在一段时间后都会渐渐忘记，于是我希望开发一个APP，用来整理我琐碎的生活碎片，让我在之后看到会回想起当时的情景和心情，于是Mosaic就诞生了

---

## 核心功能

**智能笔记系统**

- 富文本编辑器支持 Markdown 和 HTML，让写作更自由
- AI 自动标签提取内容关键词，让分类更智能
- AI 摘要生成，快速回顾长文要点

**情绪日记**

- 每日记录心情，追踪情绪变化轨迹
- 可视化情绪历史，发现情绪规律

**跨平台支持**

- 桌面端：Windows、macOS、Linux
- 移动端：iOS、Android
- 数据云端同步，随时随地访问

> 受限于开发者设备因素，目前只支持 Windows、Linux、Android 平台

---

## 目录结构

```
Mosaic/
├── desktop/     # Tauri 桌面应用
├── mobile/      # Expo 移动应用
├── server/      # Rust 后端服务
├── packages/    # 共享包
│   ├── api/     # API 类型定义
│   └── utils/   # 工具函数
└── docs/        # 文档
```

## 技术架构

- 桌面端：Tauri 2 + React 19 + TypeScript
- 移动端：Expo React Native
- 服务端：Rust + Actix Web + PostgreSQL
- AI 集成：支持多种 AI 服务提供商

---

## 使用方法

1. 考虑到数据安全，你首先需要在你自己的服务器上部署自己的 Mosaic 后端服务，用来管理自己的私人数据
   1. `mkdir mosaic-server`
   2. `cd mosaic-server`
   3. 在此文件夹下创建`.env`文件，内容参考 [.env.example](./server/.env.example)，并根据你的需要修改其中的配置项（记得修改账号名称和密码）
   4. 同样在此文件夹下创建`docker-compose.yml`文件，直接复制 [docker-compose.yml](./server/docker-compose.yml) 即可
   5. 回到mosaic-server文件夹，执行 `docker-compose up -d` 启动即可
   6. **注意**：如果遇到文件上传权限问题，执行 `chown -R 1000:1000 ~/mosaic-server/storage ~/mosaic-server/logs` 修复目录权限
   7. 之后你可以自己配置反向代理到自己的域名上
2. 下载release中的客户端连接你自己的服务器即可

---

## 开源协议

本项目基于 [AGPL-3.0 license](./LICENSE) 开源
