export const typography = {
  capitalize: (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  },
  truncate: (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str
    return str.slice(0, maxLength - 3) + '...'
  },
  wordCount: (str: string): number => {
    const trimmed = str.trim()
    if (trimmed === '') return 0
    return trimmed.split(/\s+/).length
  },
  charCount: (str: string): number => str.replace(/\s/g, '').length,
}
