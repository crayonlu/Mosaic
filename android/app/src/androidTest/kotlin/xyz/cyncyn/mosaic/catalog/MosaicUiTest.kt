package xyz.cyncyn.mosaic.catalog

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import xyz.cyncyn.mosaic.catalog.shell.MarkdownBody
import xyz.cyncyn.mosaic.design.component.MosaicButton
import xyz.cyncyn.mosaic.design.component.MoodChip
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.design.theme.ThemeDirection
import xyz.cyncyn.mosaic.design.token.MoodKey

/**
 * 设备侧 Compose UI 测试。
 *
 * 这些测试的价值不只是"渲染出来了"：Compose 测试框架的 waitUntil 有超时，
 * 一旦组合/布局被主线程上的重活（例如逐行编译正则的 markdown 解析）阻塞，
 * 断言就会超时失败——这正是之前靠肉眼看截图才发现的那类 ANR。
 */
class MosaicUiTest {

    @get:Rule
    val rule = createComposeRule()

    private val longNote: String = buildString {
        appendLine("# 同步引擎笔记")
        appendLine()
        appendLine("游标按 `updatedAt` 推进，拉取分页上限 200 条。")
        appendLine()
        repeat(200) { index ->
            appendLine("- 第 $index 行列表项，覆盖长文档解析路径")
        }
        appendLine()
        appendLine("> 离线优先：先渲染缓存，再等网络。")
        appendLine()
        appendLine("```kotlin")
        appendLine("fun sync(cursors: Cursors): SyncResult {")
        appendLine("  val pull = api.pull(cursors)")
        appendLine("  return pull.toResult()")
        appendLine("}")
        appendLine("```")
    }

    @Test
    fun markdownBody_rendersLongNote_without_blocking_composition() {
        rule.setContent {
            MosaicTheme(direction = ThemeDirection.Ink, darkTheme = false) {
                MarkdownBody(source = longNote)
            }
        }

        // 超时即失败：主线程若被解析阻塞，这里不会等到节点出现
        rule.waitUntil(timeoutMillis = 5_000) {
            rule.onAllNodesWithText("同步引擎笔记").fetchSemanticsNodes().isNotEmpty()
        }
        // 视口内：必须真的显示出来
        rule.onNodeWithText("同步引擎笔记").assertIsDisplayed()
        rule.onNodeWithText("游标按 `updatedAt` 推进，拉取分页上限 200 条。").assertIsDisplayed()
        // 200 条列表之下的内容在视口外：断言已被解析并进入语义树（存在即证明未被卡住）
        rule.onNodeWithText("离线优先：先渲染缓存，再等网络。").assertExists()
        // 代码块节点承载整段代码，用子串匹配
        rule.onNodeWithText("fun sync(cursors: Cursors): SyncResult {", substring = true).assertExists()
    }

    @Test
    fun designSystem_renders_in_both_modes_and_reacts_to_click() {
        var clicks = 0
        rule.setContent {
            MosaicTheme(direction = ThemeDirection.Ink, darkTheme = true) {
                Column {
                    MosaicText(text = "墨与宣 暗色")
                    MosaicButton(text = "收进纸间", onClick = { clicks += 1 })
                    MoodChip(mood = MoodKey.Calm, selected = true)
                    MoodChip(mood = MoodKey.Joy)
                }
            }
        }

        rule.onNodeWithText("墨与宣 暗色").assertIsDisplayed()
        rule.onNodeWithText("平静").assertIsDisplayed()
        rule.onNodeWithText("喜悦").assertIsDisplayed()
        rule.onNodeWithText("收进纸间").performClick()
        rule.runOnIdle { check(clicks == 1) { "button click did not reach the handler" } }
    }

    @Test
    fun markdownBody_handles_unclosed_fence_and_empty_input() {
        rule.setContent {
            MosaicTheme(direction = ThemeDirection.Ink, darkTheme = false) {
                Column {
                    MarkdownBody(source = "```json\n{\"a\": 1}")
                    MarkdownBody(source = "")
                }
            }
        }
        rule.waitUntil(timeoutMillis = 5_000) {
            rule.onAllNodesWithText("json").fetchSemanticsNodes().isNotEmpty()
        }
        rule.onNodeWithText("json").assertIsDisplayed()
        rule.onNodeWithText("{\"a\": 1}", substring = true).assertExists()
    }
}
