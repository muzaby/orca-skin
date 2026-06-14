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
  // Main 프로세스 레이어 경계 강제 (handoff 0017) — 하향 의존만 허용, 상위 참조 금지.
  // DAG: L0 shared → L1 domain → L2 adapters → L3 ipc (정본 가이드: src/main/AGENTS.md).
  // renderer 블록과 동형(eslint-plugin-boundaries) + import/no-cycle 로 같은-레이어 순환까지 차단
  // (0011 config↔mcp 순환 클래스 재발 방지 — boundaries 는 레이어 방향만 보므로 보강).
  {
    files: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
    plugins: { boundaries: eslintPluginBoundaries, import: eslintPluginImport },
    settings: {
      'boundaries/root-path': '.',
      // import/no-cycle 가 의존 .ts 파일을 파싱해 역-에지를 따라가려면 TS 파서를 등록해야 한다
      // (없으면 그래프가 얕아져 순환을 못 잡는다 — flat config 알려진 이슈).
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }
      },
      'boundaries/include': ['src/main/**/*', 'src/shared/**/*'],
      'boundaries/elements': [
        // 컴포지션 루트 — src/main 직속 entry 파일(index.ts). 하위 전부 의존 허용.
        { type: 'main-root', pattern: 'src/main/*.ts', mode: 'file' },
        // L3 ipc — 라우터·핸들러·chat 오케스트레이션. 누구도 ipc 를 의존하지 않는다.
        { type: 'ipc', pattern: 'src/main/ipc', mode: 'folder' },
        // L2 adapters — SessionAdapter 구현 + 어댑터 오케스트레이션(installer = registry 사용).
        { type: 'adapters', pattern: 'src/main/adapters', mode: 'folder' },
        { type: 'adapters', pattern: 'src/main/installer', mode: 'folder' },
        // L1 domain/infra — 그 외 src/main 하위 전부(db·config·settings·mcp·runtime·…).
        { type: 'domain', pattern: 'src/main/*', mode: 'folder' },
        // L0 shared — 순수 타입/상수/스키마. 내부(shared)만 의존.
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
            {
              from: { type: 'main-root' },
              allow: { to: { type: ['main-root', 'ipc', 'adapters', 'domain', 'shared'] } }
            },
            { from: { type: 'ipc' }, allow: { to: { type: ['ipc', 'adapters', 'domain', 'shared'] } } },
            { from: { type: 'adapters' }, allow: { to: { type: ['adapters', 'domain', 'shared'] } } },
            { from: { type: 'domain' }, allow: { to: { type: ['domain', 'shared'] } } },
            { from: { type: 'shared' }, allow: { to: { type: 'shared' } } }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
