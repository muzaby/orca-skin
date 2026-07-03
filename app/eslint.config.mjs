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
  // 목표 DAG: shared → infra → adapters(ports&adapters) → features(수직 슬라이스) → app(컴포지션 루트).
  // contracts = main 내부 타입 계약(구현 0). **전환 중(0062 진행)**: 아직 안 옮긴 디렉토리는 `legacy`
  // catch-all 로 분류하고 관용 규칙을 둔다 — 재배치 완료 후 legacy 제거 + 엄격화(체크리스트 마지막 단계).
  // import/no-cycle 로 같은-레이어 순환까지 차단(0011 config↔mcp 재발 방지).
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
      // 순서 = specific → catch-all.
      'boundaries/elements': [
        { type: 'main-root', pattern: 'src/main/*.ts', mode: 'file' },
        { type: 'app', pattern: 'src/main/app', mode: 'folder' },
        // 어댑터 구현체(claude·mock) — engine 별 격리. 루트 adapters 는 ports/registry.
        { type: 'adapter-impl', pattern: 'src/main/adapters/*', mode: 'folder', capture: ['engine'] },
        { type: 'adapters', pattern: 'src/main/adapters', mode: 'folder' },
        { type: 'features', pattern: 'src/main/features/*', mode: 'folder', capture: ['feature'] },
        { type: 'contracts', pattern: 'src/main/contracts', mode: 'folder' },
        { type: 'infra', pattern: 'src/main/infra', mode: 'folder' },
        // 전환용 catch-all — 아직 재배치 안 된 디렉토리(ipc·lifecycle·mcp·extensions·settings·…).
        { type: 'legacy', pattern: 'src/main/*', mode: 'folder' },
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
              from: ['main-root'],
              allow: [
                'main-root',
                'app',
                'adapters',
                'adapter-impl',
                'features',
                'contracts',
                'infra',
                'legacy',
                'shared'
              ]
            },
            {
              from: ['app'],
              allow: [
                'app',
                'main-root',
                'adapters',
                'adapter-impl',
                'features',
                'contracts',
                'infra',
                'legacy',
                'shared'
              ]
            },
            // adapters ports → 구현체·infra·shared (+ 전환 중 legacy 임시 허용).
            { from: ['adapters'], allow: ['adapters', 'adapter-impl', 'infra', 'shared', 'legacy'] },
            {
              from: ['adapter-impl'],
              allow: ['adapter-impl', 'adapters', 'infra', 'shared', 'legacy']
            },
            // features → 포트·계약·infra·shared (+ 전환 중 features 교차·legacy 임시 허용).
            {
              from: ['features'],
              allow: ['features', 'contracts', 'adapters', 'adapter-impl', 'infra', 'shared', 'legacy']
            },
            { from: ['contracts'], allow: ['contracts', 'adapters', 'infra', 'shared', 'legacy'] },
            { from: ['infra'], allow: ['infra', 'shared', 'legacy'] },
            // legacy(전환) → 사실상 전부(재배치가 끝나면 이 요소 자체가 사라진다).
            {
              from: ['legacy'],
              allow: [
                'legacy',
                'adapters',
                'adapter-impl',
                'features',
                'contracts',
                'infra',
                'shared'
              ]
            },
            { from: ['shared'], allow: ['shared'] }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
