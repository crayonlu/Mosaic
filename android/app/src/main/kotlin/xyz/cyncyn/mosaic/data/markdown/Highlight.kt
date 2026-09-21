package xyz.cyncyn.mosaic.data.markdown

/**
 * Minimal syntax highlighter (pure function, no dependencies).
 * Produces spans for keyword/string/comment/number/function so the UI can
 * color them with design tokens (no third-party tokenizer).
 */

enum class TokenKind { Keyword, String_, Comment, Number_, Function, Plain }

data class CodeSpan(val start: Int, val end: Int, val kind: TokenKind)

private val KEYWORDS = mapOf(
    "kotlin" to setOf(
        "fun", "val", "var", "if", "else", "for", "while", "return", "class", "object", "interface",
        "data", "sealed", "import", "package", "private", "public", "internal", "suspend", "when",
        "null", "true", "false", "this", "super", "is", "in", "as", "try", "catch", "finally", "throw",
    ),
    "java" to setOf(
        "public", "private", "protected", "class", "interface", "static", "final", "void", "int",
        "long", "boolean", "return", "if", "else", "for", "while", "new", "null", "true", "false",
        "this", "extends", "implements", "import", "package", "try", "catch", "finally", "throw",
    ),
    "javascript" to setOf(
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "extends",
        "import", "export", "default", "async", "await", "null", "undefined", "true", "false", "new",
        "this", "try", "catch", "finally", "throw", "typeof",
    ),
    "typescript" to setOf(
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "extends",
        "implements", "interface", "type", "import", "export", "default", "async", "await", "null",
        "undefined", "true", "false", "new", "this", "try", "catch", "throw", "typeof", "readonly",
    ),
    "python" to setOf(
        "def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as",
        "None", "True", "False", "and", "or", "not", "in", "is", "try", "except", "finally",
        "raise", "with", "lambda", "yield", "pass", "global", "async", "await",
    ),
    "rust" to setOf(
        "fn", "let", "mut", "const", "struct", "enum", "impl", "trait", "pub", "use", "mod",
        "match", "if", "else", "loop", "while", "for", "in", "return", "Some", "None", "Ok", "Err",
        "self", "Self", "true", "false", "where", "dyn", "async", "await", "move",
    ),
)

private val ALIASES = mapOf(
    "kt" to "kotlin",
    "kts" to "kotlin",
    "js" to "javascript",
    "jsx" to "javascript",
    "ts" to "typescript",
    "tsx" to "typescript",
    "py" to "python",
    "rb" to "python",
    "rs" to "rust",
)

private fun hashComments(language: String?): Boolean =
    language == "python" || language == "ruby" || language == "bash" || language == "shell" || language == "yaml"

fun highlightCode(code: String, rawLanguage: String?): List<CodeSpan> {
    val language = ALIASES[rawLanguage?.lowercase()] ?: rawLanguage?.lowercase()
    val keywords = KEYWORDS[language] ?: KEYWORDS.getValue("kotlin")
    val hashesAsComments = hashComments(language)

    val spans = mutableListOf<CodeSpan>()
    var i = 0
    val n = code.length

    fun isIdentStart(c: Char) = c.isLetter() || c == '_'
    fun isIdentPart(c: Char) = c.isLetterOrDigit() || c == '_'

    while (i < n) {
        val c = code[i]
        when {
            c == '/' && i + 1 < n && code[i + 1] == '/' -> {
                var j = i
                while (j < n && code[j] != '\n') j += 1
                spans.add(CodeSpan(i, j, TokenKind.Comment))
                i = j
            }
            c == '/' && i + 1 < n && code[i + 1] == '*' -> {
                var j = code.indexOf("*/", i + 2)
                j = if (j == -1) n else j + 2
                spans.add(CodeSpan(i, j, TokenKind.Comment))
                i = j
            }
            c == '#' && hashesAsComments -> {
                var j = i
                while (j < n && code[j] != '\n') j += 1
                spans.add(CodeSpan(i, j, TokenKind.Comment))
                i = j
            }
            c == '"' || c == '\'' || c == '`' -> {
                var j = i + 1
                while (j < n) {
                    if (code[j] == '\\') {
                        j += 2
                        continue
                    }
                    if (code[j] == c || code[j] == '\n' && c != '`') break
                    j += 1
                }
                val end = minOf(n, j + 1)
                spans.add(CodeSpan(i, end, TokenKind.String_))
                i = end
            }
            c.isDigit() -> {
                var j = i
                while (j < n && (code[j].isLetterOrDigit() || code[j] == '.' || code[j] == '_')) j += 1
                spans.add(CodeSpan(i, j, TokenKind.Number_))
                i = j
            }
            isIdentStart(c) -> {
                var j = i
                while (j < n && isIdentPart(code[j])) j += 1
                val word = code.substring(i, j)
                var k = j
                while (k < n && code[k] == ' ') k += 1
                val kind = when {
                    word in keywords -> TokenKind.Keyword
                    k < n && code[k] == '(' -> TokenKind.Function
                    else -> TokenKind.Plain
                }
                if (kind != TokenKind.Plain) spans.add(CodeSpan(i, j, kind))
                i = j
            }
            else -> i += 1
        }
    }
    return spans
}
