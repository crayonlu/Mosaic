import baseConfig from '../../eslint.config.js'

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },]
