# Mosaic Android（Compose 重写）

全量重写的 Android 端。设计系统纯 `foundation` 实现，**零 Material 依赖**——非 Material 的自定义设计语言。

## 模块

| 模块 | 内容 |
| --- | --- |
| `:design-core` | 三层 token（Palette → Semantic → Component）+ 基础组件（MosaicText / MosaicButton / MoodChip）+ 自定义按压反馈 |
| `:app` | Catalog 设计目录：4 个设计方向 × 明暗实时切换、WCAG 对比度标注、组件样例 |

## 设计方向（已定稿）

**墨与宣 Ink** —— 暖纸画布 + 暖墨水，无彩色强调色：层级靠字重与深浅，色彩只属于内容（心情色是全 App 唯一的彩色签名）。参考 Notion / iA Writer 的暖中性路线。

Catalog 保留其余三个候选（陶土 / 苔绿 / 靛蓝）作对照，入口在「我的 → 设计目录」。

## 运行

```bash
cd android
./gradlew :app:installDebug          # 装到已连接的设备/模拟器
adb shell am start -n xyz.cyncyn.mosaic.catalog/.MainActivity
```

## token 结构

```
theme/Palettes.kt     第一层：4 方向 × 明暗原始色板（UI 不直接引用）
token/MosaicColors.kt 第二层：语义角色（UI 只读这层，暗色在此分叉）
token/Mood.kt         第三层：心情内容色 ramp（container/onContainer/border）
token/MosaicTypography.kt  七级字阶（sp，随系统缩放）
```

换方向 / 换明暗只是换 Palette 数据，Semantic 层与组件零改动。

## 环境

- Gradle 8.14.3（wrapper 复用 RN 的本地发行版）、AGP 8.13.0、Kotlin 2.2.20
- Compose BOM 2025.08.01（compose 1.9：含 dropShadow / innerShadow）
- compileSdk 36 / minSdk 26 / JDK 21
- 依赖走 `~/.gradle/init.gradle` 的阿里云镜像（settings 里 `PREFER_PROJECT`）
