# Mosaic 发版指南

## 版本号说明

当前版本基线（2026-10-06）：

| 文件 / 目标           | 当前版本        | 说明                                    |
| --------------------- | --------------- | --------------------------------------- |
| 根 `package.json`     | `1.2.1`         | workspace 版本                          |
| `mobile/package.json` | `1.0.15`        | 移动端独立版本号                        |
| `server-go`           | `server-v1.1.5` | 生产 Go 服务端，用 Git tag 表示发布版本 |
| `server/Cargo.toml`   | `1.0.5`         | Rust 参考实现，非生产后端               |

> 移动端与服务端各自独立版本号，根 package.json 为 workspace 版本。
>
> **生产服务端是 Go**（`server-go/`）。Rust 树（`server/`）是参考实现，仅在改动参考
> 实现或准备回滚镜像时同步版本。

## 发版步骤

下文 `v1.0.16` 和 `server-v1.1.6` 为下一版本示例，按实际发布目标调整。

### 1. 创建发布分支

```bash
git checkout -b release/v1.0.16
```

### 2. 更新版本号

修改以下文件中的版本号（以 `v1.0.16` 为例）：

- `mobile/package.json`: `"version": "1.0.16"`

Go 服务端不在源码中维护版本常量，发布版本由 Git tag（`server-vX.Y.Z`）表示，无需修改
Go 文件。

### 3. 提交并推送

```bash
git add .
git commit -m "chore: release v1.0.16"
git push origin release/v1.0.16
```

### 4. 创建并推送 Tag

移动端（触发 APK 构建）：

```bash
git tag v1.0.16
git push origin v1.0.16
```

Go 服务端（触发镜像构建）：

```bash
git tag server-v1.1.6
git push origin server-v1.1.6
```

`server-v*` tag 会触发 `.github/workflows/build-docker.yml` 构建并推送镜像，并按
`server-go/Dockerfile` 生成 `latest` 标签。该镜像工作流也监听移动端的 `v*` 标签；
发布移动端时，同一提交的 Go 镜像也会构建并更新 `latest`，部署应固定已验证的标签或摘要。

### 5. 创建 GitHub Release

1. 访问 [Releases](https://github.com/crayonlu/Mosaic/releases) 页面
2. 点击 "Create a new release"
3. 选择对应标签（`v1.0.16` 或 `server-v1.1.6`）
4. 填写发布说明，列出实际变更和验证结果
5. 发布 Release

## 分支策略

- `main`: 主分支，包含所有功能
- `release/vX.Y.Z`: 发布分支，用于特定版本发布
- 标签: `vX.Y.Z` 用于移动端，`server-vX.Y.Z` 用于 Go 服务端
