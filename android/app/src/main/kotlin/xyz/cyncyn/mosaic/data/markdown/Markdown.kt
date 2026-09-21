package xyz.cyncyn.mosaic.data.markdown

/**
 * Block-level markdown splitter (pure function, no dependencies).
 * Supports: ATX headings, fenced code blocks (```lang), block quotes,
 * bullet/ordered lists, horizontal rules, paragraphs.
 */

enum class MarkdownBlockType { Heading, Paragraph, CodeFence, Quote, ListItem, Rule }

data class MarkdownBlock(
    val type: MarkdownBlockType,
    val text: String = "",
    val language: String? = null,
    val level: Int = 0,
    val items: List<String> = emptyList(),
)

fun splitMarkdownBlocks(source: String): List<MarkdownBlock> {
    val lines = source.lines()
    val blocks = mutableListOf<MarkdownBlock>()
    var i = 0

    fun at(i: Int): String = if (i in lines.indices) lines[i] else ""

    while (i < lines.size) {
        val line = at(i)
        val trimmed = line.trim()

        // blank line
        if (trimmed.isEmpty()) {
            i += 1
            continue
        }

        // fenced code
        if (trimmed.startsWith("```")) {
            val language = trimmed.removePrefix("```").trim().ifEmpty { null }
            val code = StringBuilder()
            i += 1
            while (i < lines.size && !at(i).trim().startsWith("```")) {
                code.appendLine(at(i))
                i += 1
            }
            i += 1 // closing fence
            blocks.add(
                MarkdownBlock(
                    type = MarkdownBlockType.CodeFence,
                    text = code.toString().removeSuffix("\n"),
                    language = language,
                ),
            )
            continue
        }

        // horizontal rule
        if (trimmed == "---" || trimmed == "***" || trimmed == "___") {
            blocks.add(MarkdownBlock(type = MarkdownBlockType.Rule))
            i += 1
            continue
        }

        // heading
        val heading = Regex("^(#{1,6})\\s+(.*)$").find(trimmed)
        if (heading != null) {
            blocks.add(
                MarkdownBlock(
                    type = MarkdownBlockType.Heading,
                    text = heading.groupValues[2].trim(),
                    level = heading.groupValues[1].length,
                ),
            )
            i += 1
            continue
        }

        // block quote
        if (trimmed.startsWith(">")) {
            val quoteLines = mutableListOf<String>()
            while (i < lines.size && at(i).trim().startsWith(">")) {
                quoteLines.add(at(i).trim().removePrefix(">").trim())
                i += 1
            }
            blocks.add(MarkdownBlock(type = MarkdownBlockType.Quote, text = quoteLines.joinToString("\n")))
            continue
        }

        // lists (bullet or ordered)
        val bullet = Regex("^[-*+]\\s+(.*)$")
        val ordered = Regex("^(\\d+)[.)]\\s+(.*)$")
        if (bullet.find(trimmed) != null || ordered.find(trimmed) != null) {
            val items = mutableListOf<String>()
            while (i < lines.size) {
                val current = at(i).trim()
                if (current.isEmpty()) break
                val b = bullet.find(current)
                val o = ordered.find(current)
                if (b != null) {
                    items.add(b.groupValues[1])
                } else if (o != null) {
                    items.add(o.groupValues[2])
                } else if (items.isNotEmpty() && current.startsWith("  ")) {
                    // continuation of the previous item
                    items[items.size - 1] = items.last() + " " + current.trim()
                } else {
                    break
                }
                i += 1
            }
            blocks.add(MarkdownBlock(type = MarkdownBlockType.ListItem, items = items))
            continue
        }

        // paragraph: consecutive non-empty, non-structural lines
        val paragraph = mutableListOf<String>()
        while (i < lines.size) {
            val current = at(i)
            val currentTrim = current.trim()
            if (currentTrim.isEmpty()) break
            if (currentTrim.startsWith("```") || currentTrim == "---" || currentTrim.startsWith("#") ||
                currentTrim.startsWith(">") || bullet.find(currentTrim) != null || ordered.find(currentTrim) != null
            ) {
                break
            }
            paragraph.add(currentTrim)
            i += 1
        }
        if (paragraph.isNotEmpty()) {
            blocks.add(MarkdownBlock(type = MarkdownBlockType.Paragraph, text = paragraph.joinToString("\n")))
        }
    }
    return blocks
}
