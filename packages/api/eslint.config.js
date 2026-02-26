import baseConfig from '../../eslint.config.js'

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    settings: {
      react: {
        version: '999.999.999', // Disable React version detection for non-React packages
      },
    },
    rules: {
      // Disable React rules for non-React packages
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-deprecated': 'off',
      'react/no-unknown-property': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]
