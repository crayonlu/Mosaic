import baseConfig from '../eslint.config.js'

export default [
  ...baseConfig,
  {
    ignores: [
      'src-tauri/**',
      'src/components/ui/**',
      'dist/**',
      'node_modules/**',
    ],
  },
]
