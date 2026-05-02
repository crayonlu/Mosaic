import { useRef } from 'react'

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

function isEmptyListLine(line: string): boolean {
  const taskDone = line.match(TASK_DONE)
  if (taskDone) return line.slice(taskDone[0].length).trim() === ''
  const taskOpen = line.match(TASK_OPEN)
  if (taskOpen) return line.slice(taskOpen[0].length).trim() === ''
  const unordered = line.match(UNORDERED)
  if (unordered) return line.slice(unordered[0].length).trim() === ''
  const ordered = line.match(ORDERED)
  if (ordered) return line.slice(ordered[0].length).trim() === ''
  return false
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
  onChange: (text: string) => void,
): {
  handleChange: (newText: string) => void
  handleSelectionChange: (event: { nativeEvent: { selection: Selection } }) => void
} {
  const selectionRef = useRef<Selection>({ start: 0, end: 0 })

  function handleSelectionChange(event: { nativeEvent: { selection: Selection } }) {
    selectionRef.current = event.nativeEvent.selection
  }

  function handleChange(newText: string) {
    const cursor = selectionRef.current.start

    // Detect a single newline insertion
    if (newText.length !== value.length + 1) {
      onChange(newText)
      return
    }

    // Multi-char selection replaced — don't intervene
    if (selectionRef.current.start !== selectionRef.current.end) {
      onChange(newText)
      return
    }

    // The inserted character must be \n
    const insertedChar = newText[cursor - 1]
    if (insertedChar !== '\n') {
      onChange(newText)
      return
    }

    // Find the line that was just completed (above the new \n)
    const textBeforeCursor = newText.slice(0, cursor - 1)
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
