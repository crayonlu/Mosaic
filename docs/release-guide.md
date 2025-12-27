# Mosaic 发版指南

## 发版步骤

### 1. 创建发布分支

```bash
git checkout -b release/v1.0.0
```

### 2. 更新版本号

修改以下文件中的版本号：

- `package.json`: `"version": "1.0.0"`
- `src-tauri/tauri.conf.json`: `"version": "1.0.0"`
- `src-tauri/Cargo.toml`: `version = "1.0.0"`

### 3. 提交并推送

```bash
git add .
git commit -m "chore: release v1.0.0"
git push origin release/v1.0.0
```

### 4. 创建并推送Tag

```bash
git tag v1.0.0

git push origin v1.0.0
```

### 5. 创建 GitHub Release

1. 访问 [Releases](https://github.com/crayonlu/Mosaic/releases) 页面
2. 点击 "Create a new release"
3. 选择标签 `v1.0.0`
4. 填写发布说明
5. 发布 Release

## 分支策略

- `main`: 主分支，包含所有功能
- `release/vX.Y.Z`: 发布分支，用于特定版本发布
- 标签: `vX.Y.Z` 用于触发 CI 构建
