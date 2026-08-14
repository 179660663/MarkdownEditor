export async function exportToHtml(content: string): Promise<boolean> {
  try {
    const result = await window.electronAPI.exportHtml(content)
    return result
  } catch (e) {
    console.error('Export HTML failed:', e)
    return false
  }
}

export async function exportToPdf(content: string): Promise<boolean> {
  try {
    const result = await window.electronAPI.exportPdf(content)
    return result
  } catch (e) {
    console.error('Export PDF failed:', e)
    return false
  }
}

export function countWords(content: string) {
  const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = (content.match(/[a-zA-Z]+/g) || []).length
  const totalChars = content.length
  const chineseReadingTime = chineseChars / 300
  const englishReadingTime = englishWords / 200
  const readingTimeMinutes = Math.max(1, Math.ceil(chineseReadingTime + englishReadingTime))

  return {
    chineseChars,
    englishWords,
    totalChars,
    readingTimeMinutes
  }
}