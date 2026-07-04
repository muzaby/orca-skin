import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginBoundaries from 'eslint-plugin-boundaries'
import eslintPluginImport from 'eslint-plugin-import'

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
  // Main 프로세스 레이어 경계 강제 (handoff 0062 재구성 — 아키텍처 스펙).
  // DAG: shared → infra → adapters(ports&adapters) → contracts(타입 계약) → features(수직 슬라이스) → app(컴포지션 루트).
  // 핵심 규칙: **features 는 같은 feature + contracts/adapters/infra/shared 만** — feature↔feature 교차 차단.
  // contracts = main 내부 타입 계약(TurnContext·bus-events·ports·session-state, 구현 최소). import/no-cycle 로
  // 같은-레이어 순환까지 차단(0011 config↔mcp 재발 방지).
  {
    files: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
    plugins: { boundaries: eslintPluginBoundaries, import: eslintPluginImport },
    settings: {
      'boundaries/root-path': '.',
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }
      },
      'boundaries/include': ['src/main/**/*', 'src/shared/**/*'],
      // 순서 = specific → catch-all (adapter-impl 가 adapters 보다 먼저).
      'boundaries/elements': [
        { type: 'main-root', pattern: 'src/main/*.ts', mode: 'file' },
        { type: 'app', pattern: 'src/main/app', mode: 'folder' },
        // 어댑터 구현체(claude·mock 서브폴더) — engine 별 격리. 루트 adapters 는 ports/registry.
        { type: 'adapter-impl', pattern: 'src/main/adapters/*', mode: 'folder', capture: ['engine'] },
        { type: 'adapters', pattern: 'src/main/adapters', mode: 'folder' },
        { type: 'features', pattern: 'src/main/features/*', mode: 'folder', capture: ['feature'] },
        { type: 'contracts', pattern: 'src/main/contracts', mode: 'folder' },
        { type: 'infra', pattern: 'src/main/infra', mode: 'folder' },
        { type: 'shared', pattern: 'src/shared', mode: 'folder' }
      ]
    },
    rules: {
      'import/no-cycle': ['error', { maxDepth: Infinity }],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // 컴포지션 루트(index.ts·app/) → 전부 (구체 엔진명 리터럴 허용, 1회성 배선).
            {
              from: { type: 'main-root' },
              allow: {
                to: {
                  type: ['main-root', 'app', 'adapters', 'adapter-impl', 'features', 'contracts', 'infra', 'shared']
                }
              }
            },
            {
              from: { type: 'app' },
              allow: {
                to: {
                  type: ['app', 'main-root', 'adapters', 'adapter-impl', 'features', 'contracts', 'infra', 'shared']
                }
              }
            },
            // adapters(ports&adapters) → 구현체·infra·shared.
            { from: { type: 'adapters' }, allow: { to: { type: ['adapters', 'adapter-impl', 'infra', 'shared'] } } },
            { from: { type: 'adapter-impl' }, allow: { to: { type: ['adapter-impl', 'adapters', 'infra', 'shared'] } } },
            // features → **같은 feature 만** (교차 차단) + contracts/adapters/infra/shared.
            {
              from: { type: 'features' },
              allow: { to: { type: 'features', captured: { feature: '{{from.feature}}' } } }
            },
            {
              from: { type: 'features' },
              allow: { to: { type: ['contracts', 'adapters', 'adapter-impl', 'infra', 'shared'] } }
            },
            { from: { type: 'contracts' }, allow: { to: { type: ['contracts', 'adapters', 'infra', 'shared'] } } },
            { from: { type: 'infra' }, allow: { to: { type: ['infra', 'shared'] } } },
            { from: { type: 'shared' }, allow: { to: { type: 'shared' } } }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
