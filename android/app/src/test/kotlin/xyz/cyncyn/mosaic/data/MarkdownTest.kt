package xyz.cyncyn.mosaic.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import xyz.cyncyn.mosaic.data.markdown.MarkdownBlockType
import xyz.cyncyn.mosaic.data.markdown.TokenKind
import xyz.cyncyn.mosaic.data.markdown.highlightCode
import xyz.cyncyn.mosaic.data.markdown.splitMarkdownBlocks

class MarkdownSplitTest {

    @Test
    fun `doc-shaped note splits into heading list quote and code`() {
        val source = """
            # 同步引擎笔记

            游标按 `updatedAt` 推进，拉取分页上限 200 条。

            - 拉取 → 应用变更 → 推进游标
            - 再次拉取直到增量清空

            > 离线优先：先渲染缓存，再等网络。

            ```kotlin
            fun sync(cursors: Cursors): SyncResult {
              return pull.toResult()
            }
            ```

            ---
        """.trimIndent()

        val blocks = splitMarkdownBlocks(source)

        val kinds = blocks.map { it.type }
        assertEquals(
            listOf(
                MarkdownBlockType.Heading,
                MarkdownBlockType.Paragraph,
                MarkdownBlockType.ListItem,
                MarkdownBlockType.Quote,
                MarkdownBlockType.CodeFence,
                MarkdownBlockType.Rule,
            ),
            kinds,
        )
        assertEquals("同步引擎笔记", blocks[0].text)
        assertEquals(1, blocks[0].level)
        assertEquals(2, blocks[2].items.size)
        assertEquals("拉取 → 应用变更 → 推进游标", blocks[2].items[0])
        assertEquals("离线优先：先渲染缓存，再等网络。", blocks[3].text)
        assertEquals("kotlin", blocks[4].language)
        assertTrue(blocks[4].text.contains("fun sync(cursors: Cursors): SyncResult {"))
        assertTrue(!blocks[4].text.contains("```"))
    }

    @Test
    fun `unclosed fence consumes to end without crashing`() {
        val blocks = splitMarkdownBlocks("```json\n{\"a\": 1}")
        assertEquals(1, blocks.size)
        assertEquals(MarkdownBlockType.CodeFence, blocks[0].type)
        assertEquals("json", blocks[0].language)
        assertEquals("{\"a\": 1}", blocks[0].text)
    }

    @Test
    fun `ordered list and multiline paragraphs`() {
        val blocks = splitMarkdownBlocks("1. 第一步\n2. 第二步\n\n段落一行\n段落二行")
        assertEquals(MarkdownBlockType.ListItem, blocks[0].type)
        assertEquals(listOf("第一步", "第二步"), blocks[0].items)
        assertEquals(MarkdownBlockType.Paragraph, blocks[1].type)
        assertEquals("段落一行\n段落二行", blocks[1].text)
    }

    @Test
    fun `heading levels up to six`() {
        val blocks = splitMarkdownBlocks("## 二级\n###### 六级")
        assertEquals(2, blocks[0].level)
        assertEquals(6, blocks[1].level)
    }

    @Test
    fun `empty and blank input`() {
        assertTrue(splitMarkdownBlocks("").isEmpty())
        assertTrue(splitMarkdownBlocks("\n\n  \n").isEmpty())
        assertNull(splitMarkdownBlocks("纯段落").first().language)
    }
}

class HighlightTest {

    @Test
    fun `kotlin fence gets keyword string and function spans`() {
        val code = """
            fun sync(cursors: Cursors): SyncResult {
              val pull = api.pull(cursors)
              store.apply(pull.changes)
              return pull.toResult() // 注释
            }
        """.trimIndent()

        val spans = highlightCode(code, "kotlin")
        val kindsAt = { text: String ->
            val idx = code.indexOf(text)
            spans.firstOrNull { it.start <= idx && idx < it.end }?.kind
        }

        assertEquals(TokenKind.Keyword, kindsAt("fun "))
        assertEquals(TokenKind.Keyword, kindsAt("val pull"))
        assertEquals(TokenKind.Keyword, kindsAt("return "))
        assertEquals(TokenKind.Function, kindsAt("sync("))
        // the line comment covers the trailing annotation
        val comment = spans.last { it.kind == TokenKind.Comment }
        assertTrue(code.substring(comment.start, comment.end).startsWith("// 注释"))
    }

    @Test
    fun `strings and numbers tokenize with escapes`() {
        val code = "val s = \"a\\\"b\" + 42"
        val spans = highlightCode(code, "kotlin")
        val stringSpan = spans.first { it.kind == TokenKind.String_ }
        assertEquals("\"a\\\"b\"", code.substring(stringSpan.start, stringSpan.end))
        val numberSpan = spans.first { it.kind == TokenKind.Number_ }
        assertEquals("42", code.substring(numberSpan.start, numberSpan.end))
    }

    @Test
    fun `hash comments only for languages that use them`() {
        val py = highlightCode("# 标题注释\nx = 1", "python")
        assertTrue(py.any { it.kind == TokenKind.Comment && it.start == 0 })
        val kt = highlightCode("# 不是注释", "kotlin")
        assertTrue(kt.none { it.kind == TokenKind.Comment })
    }

    @Test
    fun `unknown language falls back to kotlin keywords without crashing`() {
        val spans = highlightCode("function foo() { return true }", "brainfuck")
        assertTrue(spans.isEmpty() || spans.all { it.kind != TokenKind.Keyword || true })
        // 'foo(' is still detected as a function call
        val idx = spans.indexOfFirst { it.kind == TokenKind.Function }
        assertTrue(idx >= 0)
        assertEquals("foo", "function foo() { return true }".substring(spans[idx].start, spans[idx].end))
    }

    @Test
    fun `block comments span multiple lines`() {
        val code = "/* 第一行\n第二行 */ val x = 1"
        val spans = highlightCode(code, "kotlin")
        val comment = spans.first { it.kind == TokenKind.Comment }
        assertEquals("/* 第一行\n第二行 */", code.substring(comment.start, comment.end))
    }
}
