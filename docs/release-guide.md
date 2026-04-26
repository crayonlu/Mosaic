# Mosaic 发版指南

## 版本号说明

当前版本基线：
| 文件 | 当前版本 |
|------|---------|
| 根 `package.json` | `1.2.0` |
| `desktop/package.json` | `2.5.7` |
| `mobile/package.json` | `2.5.7` |
| `desktop/src-tauri/tauri.conf.json` | `2.5.7` |
| `server/Cargo.toml` | `0.1.0` |

> Desktop/Mobile 共享主版本号，Server 独立版本号，根 package.json 为 workspace 版本。

## 发版步骤

### 1. 创建发布分支

```bash
git checkout -b release/v2.5.7
```

### 2. 更新版本号

修改以下文件中的版本号（以 `v2.5.7` 为例）：

- `package.json`: `"version": "2.5.7"`（根 workspace）
- `desktop/package.json`: `"version": "2.5.7"`
- `mobile/package.json`: `"version": "2.5.7"`
- `desktop/src-tauri/tauri.conf.json`: `"version": "2.5.7"`
- `server/Cargo.toml`（如需同步）: `version = "0.1.0"`

### 3. 提交并推送

```bash
git add .
git commit -m "chore: release v2.5.7"
git push origin release/v2.5.7
```

### 4. 创建并推送Tag

```bash
git tag v2.5.7
git push origin v2.5.7
```

### 5. 创建 GitHub Release

1. 访问 [Releases](https://github.com/crayonlu/Mosaic/releases) 页面
2. 点击 "Create a new release"
3. 选择标签 `v2.5.7`
4. 填写发布说明（参考 `docs/internal/progress-and-roadmap.md` 版本里程碑）
5. 发布 Release

## 分支策略

- `main`: 主分支，包含所有功能
- `release/vX.Y.Z`: 发布分支，用于特定版本发布
- 标签: `vX.Y.Z` 用于触发 CI 构建
