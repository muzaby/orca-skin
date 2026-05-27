import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginBoundaries from 'eslint-plugin-boundaries'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      // Provider 파일은 컴포넌트 (*Provider) + 동반 hook (use*Context) 을 함께 export
      // 하는 표준 패턴. fast-refresh 가 안전하게 다룰 수 있도록 hook export 를 명시 허용.
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'useChatContext',
            'useBackendContext',
            'useSessionsContext',
            'useProjectsContext',
            'useNavigation',
            'useTweakContext'
          ]
        }
      ]
    }
  },
  // Renderer 4-layer 경계 강제 — app → pages → features → shared, features 간 cross-import 금지.
  // CLAUDE.md "Cross-feature 의존 결정 트리" 1번 (feature 간 import 금지) 을 lint 레벨로 보장.
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    plugins: { boundaries: eslintPluginBoundaries },
    settings: {
      'boundaries/root-path': '.',
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }
      },
      'boundaries/include': ['src/renderer/src/**/*'],
      'boundaries/elements': [
        // root: src/renderer/src/ 직속 entry 파일 (App.tsx, main.tsx, env.d.ts)
        { type: 'root', pattern: 'src/renderer/src/*.{ts,tsx}', mode: 'file' },
        { type: 'app', pattern: 'src/renderer/src/app', mode: 'folder' },
        { type: 'pages', pattern: 'src/renderer/src/pages', mode: 'folder' },
        {
          type: 'features',
          pattern: 'src/renderer/src/features/*',
          mode: 'folder',
          capture: ['feature']
        },
        { type: 'shared', pattern: 'src/renderer/src/shared', mode: 'folder' }
      ]
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: { type: 'root' }, allow: { to: { type: ['app', 'pages', 'features', 'shared', 'root'] } } },
            { from: { type: 'app' }, allow: { to: { type: ['app', 'pages', 'features', 'shared'] } } },
            { from: { type: 'pages' }, allow: { to: { type: ['pages', 'features', 'shared'] } } },
            { from: { type: 'features' }, allow: { to: { type: 'shared' } } },
            {
              from: { type: 'features' },
              allow: {
                to: { type: 'features', captured: { feature: '{{from.feature}}' } }
              }
            },
            { from: { type: 'shared' }, allow: { to: { type: 'shared' } } }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
