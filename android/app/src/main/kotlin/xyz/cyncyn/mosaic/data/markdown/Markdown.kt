package xyz.cyncyn.mosaic.data.markdown

/**
 * Block-level markdown splitter (pure function, no dependencies).
 * Supports: ATX headings, fenced code blocks (```lang), block quotes,
 * bullet/ordered lists, horizontal rules, paragraphs.
 */

enum class MarkdownBlockType { Heading, Paragraph, CodeFence, Quote, ListItem, Rule }

// No regex here on purpose: per-line Pattern/Matcher creation stalled the main
// thread (ANR) during composition. Plain string scans are interpreter-fast.

private fun headingOf(line: String): Pair<Int, String>? {
    var level = 0
    while (level < line.length && line[level] == '#') level += 1
    if (level !in 1..6) return null
    if (level >= line.length || line[level] != ' ') return null
    return level to line.substring(level + 1).trim()
}

private fun bulletItemOf(line: String): String? {
    if (line.isEmpty()) return null
    if (line[0] !in "-*+") return null
    if (line.length < 2 || line[1] != ' ') return null
    return line.substring(2).trim()
}

private fun orderedItemOf(line: String): String? {
    var i = 0
    while (i < line.length && line[i].isDigit()) i += 1
    if (i == 0 || i + 1 >= line.length) return null
    if (line[i] != '.' && line[i] != ')') return null
    if (line[i + 1] != ' ') return null
    return line.substring(i + 2).trim()
}

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
        val heading = headingOf(trimmed)
        if (heading != null) {
            blocks.add(
                MarkdownBlock(
                    type = MarkdownBlockType.Heading,
                    text = heading.second,
                    level = heading.first,
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
        if (bulletItemOf(trimmed) != null || orderedItemOf(trimmed) != null) {
            val items = mutableListOf<String>()
            while (i < lines.size) {
                val current = at(i).trim()
                if (current.isEmpty()) break
                val b = bulletItemOf(current)
                val o = orderedItemOf(current)
                if (b != null) {
                    items.add(b)
                } else if (o != null) {
                    items.add(o)
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
                currentTrim.startsWith(">") || bulletItemOf(currentTrim) != null || orderedItemOf(currentTrim) != null
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
