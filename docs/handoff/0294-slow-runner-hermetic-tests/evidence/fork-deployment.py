#!/usr/bin/env python3
"""폐쇄망 포크 모사 — app/src/main/app/deployment/*.ts 를 비어 있지 않은 배포로 바꾼다.

사용: python3 fork-deployment.py <작업 트리 app 디렉토리>   (원본이 아니라 `git worktree` 사본에서만 실행)
채우는 것: 게이트·Plugin·Harness 인증, 로그인 프리 선언, Plugin binding, 런타임 모델 기여,
config API augmenter, direct credential id, 무효화 key, spawn env 주입점, 사용량 fetcher,
연결 행(gate·harness·plugin·usage). id 는 테스트 fixture 와 겹치지 않는 `acme-*` 다.
"""
import sys
d = f"{sys.argv[1]}/src/main/app/deployment"

def sub(name, old, new):
    path = f"{d}/{name}"
    text = open(path, encoding="utf8").read()
    assert old in text, (name, old)
    open(path, "w", encoding="utf8").write(text.replace(old, new, 1))

sub("auth-definitions.ts", "import type { AuthDefinition, LoginFreeDefinition } from '../../contracts/auth'",
"""import type { AuthDefinition, GateAuthDefinition, LoginFreeDefinition } from '../../contracts/auth'
import { patSpec } from '../../features/auth/specs/credential'
const BEARER = { location: 'header', name: 'Authorization', scheme: 'bearer' } as const
export const ACME_SSO = { id: 'acme-sso', label: '사내 로그인', origin: 'https://portal.acme.example', probe: { path: '/api/me' }, methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })] } satisfies GateAuthDefinition
export const ACME_WIKI = { id: 'acme-wiki', label: 'Wiki', origin: 'https://wiki.acme.example', probe: { path: '/confluence/rest/api/user/current' }, methods: [patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER })] } satisfies AuthDefinition
export const ACME_LLM = { id: 'acme-llm', label: '사내 모델', origin: 'https://llm.acme.example', probe: { path: '/api/me' }, methods: [patSpec({ label: 'API 키', fieldLabel: 'API 키', present: BEARER })] } satisfies AuthDefinition
export const ACME_PUBLIC = { id: 'acme-public', label: '공용 도구' } satisfies LoginFreeDefinition""")
sub("auth-definitions.ts", "export const AUTH_DEFINITIONS: readonly AuthDefinition[] = []",
    "export const AUTH_DEFINITIONS: readonly AuthDefinition[] = [ACME_SSO, ACME_WIKI, ACME_LLM]")
sub("auth-definitions.ts", "export const LOGIN_FREE_DEFINITIONS: readonly LoginFreeDefinition[] = []",
    "export const LOGIN_FREE_DEFINITIONS: readonly LoginFreeDefinition[] = [ACME_PUBLIC]")
sub("gate-auth.ts", "export const GATE_AUTH_DEFINITIONS: readonly GateAuthDefinition[] = []",
    "import { ACME_SSO } from './auth-definitions'\nexport const GATE_AUTH_DEFINITIONS: readonly GateAuthDefinition[] = [ACME_SSO]")
sub("spawn-env.ts", "export const SPAWN_ENV_INJECTOR: SpawnEnvInjector | undefined = undefined",
    "export const SPAWN_ENV_INJECTOR: SpawnEnvInjector | undefined = () => ({ HTTPS_PROXY: 'http://proxy.acme.example:8080' })")
sub("harness-runtime.ts", "export const RUNTIME_MODEL_CONTRIBUTIONS: readonly RuntimeModelContribution[] = []",
    "export const RUNTIME_MODEL_CONTRIBUTIONS: readonly RuntimeModelContribution[] = [{ authId: 'acme-llm', key: 'claude-acme', harnessId: 'claude', modelProviderId: 'acme' }]")
sub("harness-runtime.ts", "export const DIRECT_CREDENTIAL_AUTH_IDS: readonly AuthId[] = []",
    "export const DIRECT_CREDENTIAL_AUTH_IDS: readonly AuthId[] = ['acme-llm']")
sub("harness-runtime.ts", "export const AUTH_INVALIDATED_HARNESS_KEYS: Readonly<Record<string, readonly string[]>> = {}",
    "export const AUTH_INVALIDATED_HARNESS_KEYS: Readonly<Record<string, readonly string[]>> = { 'acme-llm': ['claude-acme'] }")
sub("harness-runtime.ts", "export function createConfigApiAugmenters(deps: HarnessConfigApiDeps): RuntimeConfigAugmenters {\n  void deps\n  return {}\n}",
"""export function createConfigApiAugmenters(deps: HarnessConfigApiDeps): RuntimeConfigAugmenters {
  void deps
  return { 'claude-acmeapi': { resolve: async () => ({ runtimeEnv: { ANTHROPIC_BASE_URL: 'https://llm.acme.example' } }) } } as RuntimeConfigAugmenters
}""")
sub("usage-fetcher.ts", "export function createUsageFetcher(deps: UsageDeploymentDeps): UsageFetcher | undefined {\n  void deps\n  return undefined\n}",
"""export function createUsageFetcher(deps: UsageDeploymentDeps): UsageFetcher | undefined {
  void deps
  return { supports: (key) => key === 'claude-acme', fetchUsage: async () => null }
}""")
sub("plugins.ts", "export function createPluginBindings(_deps: PluginDeploymentDeps): PluginBinding[] {\n  void _deps\n  return []\n}",
"""import { confluenceTools } from '../../features/plugins/confluence/tools'
export function createPluginBindings(deps: PluginDeploymentDeps): PluginBinding[] {
  const auth = deps.auth.bindForPlugin('acme-wiki')
  return [createPluginBinding({ auth, server: confluenceTools(auth, { apiBasePath: '/confluence' }), registry: deps.registry, logger: deps.logger })]
}""")
sub("connections.ts", "  return [...gateRows(deps.gateMembers), ...pluginRows(deps.plugins)]\n}",
"""  return [
    ...gateRows(deps.gateMembers),
    ...harnessRows([{ auth: deps.auth.bind('acme-llm'), harnessModelProviderKey: 'claude-acme' }]),
    ...pluginRows(deps.plugins),
    ...usageRows([{ auth: deps.auth.bind('acme-llm') }])
  ]
}""")
print("fork deployment written:", d)
