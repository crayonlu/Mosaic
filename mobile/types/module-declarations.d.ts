declare module 'markdown-it' {
  const MarkdownIt: any
  export default MarkdownIt
}

declare module 'markdown-it-task-lists' {
  const taskLists: any
  export default taskLists
}

declare module 'react-native-syntax-highlighter' {
  const SyntaxHighlighter: any
  export default SyntaxHighlighter
}

declare module 'react-syntax-highlighter/dist/cjs/styles/hljs' {
  export const atomOneDark: any
}

declare module 'lowlight' {
  export const createLowlight: any
  export const common: any
  export const all: any
}

declare module 'highlight.js/lib/languages/*' {
  const languageModule: any
  export default languageModule
}
