import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import jsxA11Y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react' // Import the react plugin
import reactHooks from 'eslint-plugin-react-hooks' // Import the react-hooks plugin
import globals from 'globals'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  ...compat.extends(
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended'
  ),
  {
    plugins: {
      'jsx-a11y': jsxA11Y,
      '@typescript-eslint': typescriptEslint,
      react: react,
      'react-hooks': reactHooks // Add the react-hooks plugin here
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',

      // Disable some rules tmemporarily,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unsafe-optional-chaining': 'off',
      'no-undef': 'off',
      'no-extra-boolean-cast': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unexpected-multiline': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-prototype-builtins': 'off',
      'no-redeclare': 'off',
      'react/prop-types': 'off',
      'react/jsx-key': 'off',
      'prefer-const': 'off',
      'no-dupe-keys': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks
      'react-hooks/exhaustive-deps': 'warn' // Checks effect dependencies
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.mocha
      }
    }
  },
  {
    ignores: [
      '**/dist/**',
      '**/.nx/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/.vercel/**',
      '**/build/**',
      '**/coverage/**',
      '**/examples/**',
      'apps/interfaces/DEPRECATED_cli/**',
      '**/.docusaurus/**',
      'apps/interfaces/chrome-extension/**',
      '**/test-temp/**',
      '**/test-output/**'
    ]
  }
]
