export function useToolbar() {
  function wrapSelectionInTextarea(
    ta: HTMLTextAreaElement,
    before: string,
    after: string,
    placeholder: string
  ): string {
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const value = ta.value
    const selected = value.substring(start, end)
    const text = selected || placeholder

    ta.value = value.substring(0, start) + before + text + after + value.substring(end)
    const newStart = start + before.length
    const newEnd = newStart + text.length
    ta.focus()
    ta.selectionStart = newStart
    ta.selectionEnd = newEnd

    return ta.value
  }

  function insertAtCursorInTextarea(ta: HTMLTextAreaElement, text: string): string {
    const start = ta.selectionStart
    const end = ta.selectionEnd
    ta.value = ta.value.substring(0, start) + text + ta.value.substring(end)
    ta.selectionStart = ta.selectionEnd = start + text.length
    ta.focus()

    return ta.value
  }

  function insertHeading(ta: HTMLTextAreaElement, level?: number): string {
    const start = ta.selectionStart
    const value = ta.value
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineEnd = value.indexOf('\n', start)
    const actualLineEnd = lineEnd === -1 ? value.length : lineEnd
    const currentLine = value.substring(lineStart, actualLineEnd)
    const match = currentLine.match(/^(#{1,6})\s?(.*)$/)

    let targetLevel: number
    if (level !== undefined) {
      targetLevel = level
    } else if (match) {
      targetLevel = match[1].length >= 6 ? 0 : match[1].length + 1
    } else {
      targetLevel = 1
    }

    const lineContent = match ? match[2] : currentLine
    let newLine: string
    if (targetLevel === 0) {
      newLine = lineContent
    } else {
      newLine = `${'#'.repeat(targetLevel)} ${lineContent}`
    }

    ta.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd)
    ta.focus()
    const cursorOffset = newLine.length - (actualLineEnd - lineStart)
    ta.selectionStart = ta.selectionEnd = start + cursorOffset

    return ta.value
  }

  function insertTable(ta: HTMLTextAreaElement, rows: number, cols: number): string {
    if (rows < 1 || cols < 1) return ta.value

    let table = '\n'
    const separatorCells: string[] = []
    const headerCells: string[] = []
    const bodyCells: string[][] = []

    for (let j = 0; j < cols; j++) {
      separatorCells.push('---')
      headerCells.push(' ')
    }

    for (let i = 1; i < rows; i++) {
      const row: string[] = []
      for (let j = 0; j < cols; j++) {
        row.push(' ')
      }
      bodyCells.push(row)
    }

    table += `| ${headerCells.join(' | ')} |\n`
    table += `| ${separatorCells.join(' | ')} |\n`
    for (const row of bodyCells) {
      table += `| ${row.join(' | ')} |\n`
    }

    return insertAtCursorInTextarea(ta, table)
  }

  function insertLink(ta: HTMLTextAreaElement, url: string, text?: string): string {
    const linkText = text || url
    const markdown = `[${linkText}](${url})`
    return insertAtCursorInTextarea(ta, markdown)
  }

  return {
    wrapSelectionInTextarea,
    insertAtCursorInTextarea,
    insertHeading,
    insertTable,
    insertLink
  }
}