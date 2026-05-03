type Selection = { start: number; end: number }

const UNORDERED = /^(\s*)([-*])\s/
const ORDERED = /^(\s*)(\d+)\.\s/
const TASK_DONE = /^(\s*)-\s\[x\]\s/i
const TASK_OPEN = /^(\s*)-\s\[ \]\s/

function getLinePrefix(line: string): string | null {
  if (TASK_DONE.test(line)) {
    return line.match(TASK_DONE)![1] + '- [ ] '
  }
  if (TASK_OPEN.test(line)) {
    return line.match(TASK_OPEN)![1] + '- [ ] '
  }
  const unordered = line.match(UNORDERED)
  if (unordered) {
    return unordered[1] + unordered[2] + ' '
  }
  const ordered = line.match(ORDERED)
  if (ordered) {
    return ordered[1] + (parseInt(ordered[2], 10) + 1) + '. '
  }
  return null
}

function getLineContent(line: string, prefix: string): string {
  return line.slice(prefix.length)
}

function getCurrentLinePrefix(line: string): string {
  const taskDone = line.match(TASK_DONE)
  if (taskDone) return taskDone[0]
  const taskOpen = line.match(TASK_OPEN)
  if (taskOpen) return taskOpen[0]
  const unordered = line.match(UNORDERED)
  if (unordered) return unordered[0]
  const ordered = line.match(ORDERED)
  if (ordered) return ordered[0]
  return ''
}

export function useListContinuation(
  value: string,
  onChange: (text: string) => void
): {
  handleChange: (newText: string) => void
  handleSelectionChange: (event: { nativeEvent: { selection: Selection } }) => void
} {
  function handleSelectionChange(_event: { nativeEvent: { selection: Selection } }) {
    // kept for API compatibility with TextInput onSelectionChange
  }

  function handleChange(newText: string) {
    // Detect a single newline insertion
    if (newText.length !== value.length + 1) {
      onChange(newText)
      return
    }

    // Find the inserted character by diffing old and new text
    // This avoids relying on the stale selectionRef (onChangeText fires before onSelectionChange)
    let insertPos = -1
    for (let i = 0; i < newText.length; i++) {
      if (newText[i] !== value[i]) {
        insertPos = i
        break
      }
    }

    if (insertPos === -1 || newText[insertPos] !== '\n') {
      onChange(newText)
      return
    }

    const cursor = insertPos + 1

    // Find the line that was just completed (above the new \n)
    const textBeforeCursor = newText.slice(0, insertPos)
    const lineStart = textBeforeCursor.lastIndexOf('\n') + 1
    const currentLine = textBeforeCursor.slice(lineStart)

    const prefix = getLinePrefix(currentLine)
    if (!prefix) {
      onChange(newText)
      return
    }

    const currentPrefix = getCurrentLinePrefix(currentLine)
    const lineContent = getLineContent(currentLine, currentPrefix)

    if (lineContent.trim() === '') {
      // Empty list item — exit list: remove the prefix from the current line
      const before = newText.slice(0, lineStart)
      const after = newText.slice(cursor)
      const fixed = before + '\n' + after
      onChange(fixed)
      // Cursor will land at lineStart + 1 (after the \n we kept)
      return
    }

    // Normal list line — insert prefix on the new line
    const before = newText.slice(0, cursor)
    const after = newText.slice(cursor)
    onChange(before + prefix + after)
  }

  return { handleChange, handleSelectionChange }
}
