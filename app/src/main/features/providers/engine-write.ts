import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { providerKeyOf, parseProviderKey, PROVIDER_NAME_RE } from '../../infra/config/provider-key'
import { orcaConfigDir } from '../../infra/config/paths'
import { writeJsonAtomic } from '../../infra/config/json-file'

const SUPPORTED_ENGINE = 'claude'

export interface EngineReadResult {
  key: string
  engine: typeof SUPPORTED_ENGINE
  provider: string
  settingsJson: string
}

export interface EngineWriteResult {
  key: string
  engine: typeof SUPPORTED_ENGINE
  provider: string
}

function requireClaudeEngine(engine: string): asserts engine is typeof SUPPORTED_ENGINE {
  if (engine !== SUPPORTED_ENGINE) throw new Error('claude engine 만 수정할 수 있습니다')
}

function normalizeProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase()
  if (!PROVIDER_NAME_RE.test(normalized)) {
    throw new Error('provider 는 영숫자 · _ · - 만 허용합니다')
  }
  return normalized
}

function settingsBase(root: string): string {
  return join(root, 'sources', 'settings', SUPPORTED_ENGINE)
}

function providerDir(provider: string, root: string): string {
  return join(settingsBase(root), provider)
}

function settingsPath(provider: string, root: string): string {
  return join(providerDir(provider, root), 'settings.json')
}

function readSettingsObject(settingsJson: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(settingsJson)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('settings.json 최상위는 객체여야 합니다')
  }
  return parsed as Record<string, unknown>
}

export function parseEngineKey(key: string): { engine: typeof SUPPORTED_ENGINE; provider: string } {
  const parsed = parseProviderKey(key, [SUPPORTED_ENGINE])
  if (!parsed || parsed.adapter !== SUPPORTED_ENGINE || !parsed.provider) {
    throw new Error('유효하지 않은 engine key 입니다')
  }
  return { engine: SUPPORTED_ENGINE, provider: normalizeProvider(parsed.provider) }
}

// settings.json 만 원자적으로 기록한다. 모델 목록은 더 이상 캐시(meta.json)에 박지 않고
// 열거 시점(provider-registry.listProviders)에 settings.json 을 파싱해 얻는다.
export function writeProviderSettings(
  engine: typeof SUPPORTED_ENGINE,
  provider: string,
  settingsJson: string,
  root: string = orcaConfigDir()
): EngineWriteResult {
  requireClaudeEngine(engine)
  const normalized = normalizeProvider(provider)
  const settings = readSettingsObject(settingsJson)
  const dir = providerDir(normalized, root)
  mkdirSync(dir, { recursive: true })
  writeJsonAtomic(join(dir, 'settings.json'), settings)
  return { key: providerKeyOf(engine, normalized), engine, provider: normalized }
}

// SSO 획득 토큰의 env 병합 기록(0130) — settings.json 이 없으면 생성, 있으면 env 블록만
// 얕은 병합한다(그 외 키 보존). 값은 리터럴 기록(현행 "env 는 사용자가 직접 쓴다" 결정과 동일
// 노출 등급). 캐시 무효화는 호출부(컴포지션 루트 thunk)가 수행한다.
export function mergeProviderEnv(
  engine: string,
  provider: string,
  env: Record<string, string>,
  root: string = orcaConfigDir()
): EngineWriteResult {
  requireClaudeEngine(engine)
  const normalized = normalizeProvider(provider)
  const path = settingsPath(normalized, root)
  const current = existsSync(path) ? readSettingsObject(readFileSync(path, 'utf8')) : {}
  const currentEnv =
    typeof current.env === 'object' && current.env !== null && !Array.isArray(current.env)
      ? (current.env as Record<string, unknown>)
      : {}
  mkdirSync(providerDir(normalized, root), { recursive: true })
  writeJsonAtomic(path, { ...current, env: { ...currentEnv, ...env } })
  return { key: providerKeyOf(engine, normalized), engine, provider: normalized }
}

export function addProviderSettings(
  engine: typeof SUPPORTED_ENGINE,
  provider: string,
  settingsJson: string,
  root: string = orcaConfigDir()
): EngineWriteResult {
  const normalized = normalizeProvider(provider)
  if (existsSync(providerDir(normalized, root))) throw new Error('이미 존재하는 provider 입니다')
  return writeProviderSettings(engine, normalized, settingsJson, root)
}

export function updateProviderSettings(
  key: string,
  settingsJson: string,
  root: string = orcaConfigDir()
): EngineWriteResult {
  const { engine, provider } = parseEngineKey(key)
  if (!existsSync(providerDir(provider, root))) throw new Error('provider 를 찾을 수 없습니다')
  return writeProviderSettings(engine, provider, settingsJson, root)
}

export function readProviderSettings(
  key: string,
  root: string = orcaConfigDir()
): EngineReadResult {
  const { engine, provider } = parseEngineKey(key)
  const path = settingsPath(provider, root)
  return {
    key: providerKeyOf(engine, provider),
    engine,
    provider,
    settingsJson: readFileSync(path, 'utf8')
  }
}

export function deleteProviderSettings(key: string, root: string = orcaConfigDir()): void {
  const { provider } = parseEngineKey(key)
  const dir = providerDir(provider, root)
  if (!existsSync(dir)) throw new Error('provider 를 찾을 수 없습니다')
  rmSync(dir, { recursive: true, force: true })
}
