export const validation = {
  email: (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  },
  url: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },
  fileExtension: (filename: string, allowedExtensions: string[]): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext ? allowedExtensions.includes(ext) : false
  },
}
