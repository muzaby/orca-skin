import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { providerKeyOf, parseProviderKey } from '../config/provider-key'
import { orcaConfigDir } from '../config/paths'
import { writeJsonAtomic } from '../deploy/scaffold'
import { OrcaModelSchema, type OrcaModelConfig } from './model-resolve'

const SUPPORTED_ENGINE = 'claude-code'
const PROVIDER_NAME_RE = /^[A-Za-z0-9_-]+$/
const MODEL_ENV_KEYS = {
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'sonnet',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus'
} as const

type ModelFamily = (typeof MODEL_ENV_KEYS)[keyof typeof MODEL_ENV_KEYS]

interface MetaEntry {
  label?: string
  models?: OrcaModelConfig[]
}

type MetaFile = Record<string, MetaEntry>

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
  models: OrcaModelConfig[]
}

function requireClaudeEngine(engine: string): asserts engine is typeof SUPPORTED_ENGINE {
  if (engine !== SUPPORTED_ENGINE) throw new Error('claude-code engine 만 수정할 수 있습니다')
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

function metaPath(root: string): string {
  return join(settingsBase(root), 'meta.json')
}

function readMeta(root: string): MetaFile {
  try {
    const raw = readFileSync(metaPath(root), 'utf8')
    const json: unknown = JSON.parse(raw)
    if (typeof json !== 'object' || json === null || Array.isArray(json)) return {}
    const out: MetaFile = {}
    for (const [provider, candidate] of Object.entries(json)) {
      if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue
      const record = candidate as Record<string, unknown>
      const parsedModels = OrcaModelSchema.array().safeParse(record.models ?? [])
      out[provider] = {
        ...(typeof record.label === 'string' ? { label: record.label } : {}),
        models: parsedModels.success ? parsedModels.data : []
      }
    }
    return out
  } catch {
    return {}
  }
}

function readSettingsObject(settingsJson: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(settingsJson)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('settings.json 최상위는 객체여야 합니다')
  }
  return parsed as Record<string, unknown>
}

function readEnv(settings: Record<string, unknown>): Record<string, unknown> {
  const env = settings.env
  if (typeof env !== 'object' || env === null || Array.isArray(env)) return {}
  return env as Record<string, unknown>
}

function modelValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function familyWithContext(name: string, family: ModelFamily): string {
  return name.toLowerCase().includes('1m') ? `${family}·1m` : family
}

function inferFamily(name: string): ModelFamily | undefined {
  const lower = name.toLowerCase()
  if (lower.includes('sonnet')) return 'sonnet'
  if (lower.includes('haiku')) return 'haiku'
  if (lower.includes('opus')) return 'opus'
  return undefined
}

function pushUnique(
  out: OrcaModelConfig[],
  seen: Set<string>,
  name: string | undefined,
  family?: ModelFamily,
  isDefault = false
): void {
  if (!name || seen.has(name)) return
  seen.add(name)
  out.push({
    name,
    ...(family ? { family: familyWithContext(name, family) } : {}),
    ...(isDefault ? { default: true } : {})
  })
}

export function extractModels(settingsJson: string): OrcaModelConfig[] {
  const settings = readSettingsObject(settingsJson)
  const env = readEnv(settings)
  const out: OrcaModelConfig[] = []
  const seen = new Set<string>()

  for (const [key, family] of Object.entries(MODEL_ENV_KEYS)) {
    pushUnique(out, seen, modelValue(env[key]), family)
  }

  const defaultModel = modelValue(env.ANTHROPIC_MODEL) ?? modelValue(settings.model)
  pushUnique(out, seen, defaultModel, defaultModel ? inferFamily(defaultModel) : undefined, true)
  if (defaultModel) {
    const existing = out.find((model) => model.name === defaultModel)
    if (existing) existing.default = true
  }

  return out
}

export function parseEngineKey(key: string): { engine: typeof SUPPORTED_ENGINE; provider: string } {
  const parsed = parseProviderKey(key, [SUPPORTED_ENGINE])
  if (!parsed || parsed.adapter !== SUPPORTED_ENGINE || !parsed.provider) {
    throw new Error('유효하지 않은 engine key 입니다')
  }
  return { engine: SUPPORTED_ENGINE, provider: normalizeProvider(parsed.provider) }
}

export function updateMeta(
  engine: typeof SUPPORTED_ENGINE,
  provider: string,
  models: OrcaModelConfig[],
  root: string = orcaConfigDir()
): void {
  requireClaudeEngine(engine)
  const normalized = normalizeProvider(provider)
  const meta = readMeta(root)
  meta[normalized] = { ...(meta[normalized] ?? {}), models }
  const path = metaPath(root)
  mkdirSync(dirname(path), { recursive: true })
  writeJsonAtomic(path, meta)
}

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
  const models = extractModels(settingsJson)
  updateMeta(engine, normalized, models, root)
  return { key: providerKeyOf(engine, normalized), engine, provider: normalized, models }
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
  const meta = readMeta(root)
  delete meta[provider]
  const path = metaPath(root)
  mkdirSync(dirname(path), { recursive: true })
  writeJsonAtomic(path, meta)
}
