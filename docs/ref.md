## Docs

- [Server API](./server-api.md)
- [已知问题](./known.md)
- [内部文档](./internal/)

## 版本信息

| 项目                      | 版本    |
| ------------------------- | ------- |
| 根 workspace              | `1.2.0` |
| Mobile (@mosaic/mobile)   | `2.5.8` |
| Server                    | `0.1.0` |

## 常用命令

```bash
# 开发/构建
bun mobile:start               # Mobile开发（Expo 54）
bun mobile:android             # Android构建运行
bun mobile:ios                 # iOS构建运行
bun mobile:web                 # Web预览

# 代码检查
bun check                      # 运行所有检查(lint + format)
bun lint                       # 检查所有子包
bun lint:api                   # 检查API包
bun lint:utils                 # 检查Utils包
bun lint:cache                 # 检查Cache包
bun lint:cache:fix             # 修复Cache包
bun lint:mobile                # 检查Mobile
bun lint:mobile:fix            # 修复Mobile

# 代码格式化
bun format                     # 格式化所有子包
bun format:api                 # 格式化API包
bun format:utils               # 格式化Utils包
bun format:cache               # 格式化Cache包
bun format:mobile              # 格式化Mobile
bun format:mobile:check        # 检查Mobile格式

# 依赖管理
bun install                    # 安装所有依赖（workspace协议）
bun install --filter mobile    # 仅Mobile
```
