// Harness settings.json 쓰기 (0017 → 0188 이설, 구 `engine-write.ts`).
//
// `sources/settings/<harness>/<modelProvider>/settings.json` 을 원자적으로 기록한다. 모델 목록은
// 캐시(구 meta.json)에 박지 않고 열거 시점(`settings.listProviders`)에 settings.json 을
// 파싱해 얻는다.
//
// **`engine` 은 wire 호환 필드다** (0188 D-005) — IPC `orca:engine:*` 채널과 `shared/protocol` 의
// DTO 가 그 이름을 쓰므로 반환 객체의 key 는 유지하고, 신규 도메인 어휘(Harness)는 타입·함수
// 이름에만 적용한다.

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { isRecord } from '../../../../shared/obj'
import { join } from 'node:path'
import {
  providerKeyOf,
  parseProviderKey,
  PROVIDER_NAME_RE
} from '../../../infra/config/provider-key'
import { orcaConfigDir } from '../../../infra/config/paths'
import { writeJsonAtomic } from '../../../infra/config/json-file'

import { HARNESS_IDS, isBackend } from '../../../../shared/harness'
import type { Backend } from '../../../../shared/ipc'

export interface HarnessSettingsReadResult {
  key: string
  engine: Backend
  provider: string
  settingsJson: string
}

export interface HarnessSettingsWriteResult {
  key: string
  engine: Backend
  provider: string
}

function requireHarness(engine: string): asserts engine is Backend {
  // 메시지 어휘는 Harness 다 (r10). 반환 객체의 `engine` **key** 는 wire 호환이라 그대로다 —
  // 바꾸는 것은 사람이 읽는 문장뿐이고 채널·DTO·DB 는 손대지 않는다(D-005).
  if (!isBackend(engine)) throw new Error('지원하지 않는 하네스입니다')
}

function normalizeProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase()
  if (!PROVIDER_NAME_RE.test(normalized)) {
    throw new Error('provider 는 영숫자 · _ · - 만 허용합니다')
  }
  return normalized
}

function settingsBase(engine: Backend, root: string): string {
  return join(root, 'sources', 'settings', engine)
}

function providerDir(engine: Backend, provider: string, root: string): string {
  return join(settingsBase(engine, root), provider)
}

function settingsPath(engine: Backend, provider: string, root: string): string {
  return join(providerDir(engine, provider, root), 'settings.json')
}

function readSettingsObject(settingsJson: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(settingsJson)
  // `isRecord` 가 `!Array.isArray` 까지 본다 — 손으로 적으면 그 항이 빠지기 쉬워 SSOT 로 둔다.
  if (!isRecord(parsed)) throw new Error('settings.json 최상위는 객체여야 합니다')
  return parsed
}

function parseHarnessSettingsKey(key: string): {
  engine: Backend
  provider: string
} {
  const parsed = parseProviderKey(key, [...HARNESS_IDS])
  if (!parsed || !isBackend(parsed.adapter) || !parsed.provider) {
    throw new Error('유효하지 않은 Harness key 입니다')
  }
  return { engine: parsed.adapter, provider: normalizeProvider(parsed.provider) }
}

// settings.json 만 원자적으로 기록한다. 모델 목록은 더 이상 캐시(meta.json)에 박지 않고
// 열거 시점(provider-registry.listProviders)에 settings.json 을 파싱해 얻는다.
function writeHarnessSettings(
  engine: Backend,
  provider: string,
  settingsJson: string,
  root: string = orcaConfigDir()
): HarnessSettingsWriteResult {
  requireHarness(engine)
  const normalized = normalizeProvider(provider)
  const settings = readSettingsObject(settingsJson)
  const dir = providerDir(engine, normalized, root)
  mkdirSync(dir, { recursive: true })
  writeJsonAtomic(join(dir, 'settings.json'), settings)
  return { key: providerKeyOf(engine, normalized), engine, provider: normalized }
}

export function addHarnessSettings(
  engine: Backend,
  provider: string,
  settingsJson: string,
  root: string = orcaConfigDir()
): HarnessSettingsWriteResult {
  const normalized = normalizeProvider(provider)
  if (existsSync(providerDir(engine, normalized, root)))
    throw new Error('이미 존재하는 provider 입니다')
  return writeHarnessSettings(engine, normalized, settingsJson, root)
}

export function updateHarnessSettings(
  key: string,
  settingsJson: string,
  root: string = orcaConfigDir()
): HarnessSettingsWriteResult {
  const { engine, provider } = parseHarnessSettingsKey(key)
  if (!existsSync(providerDir(engine, provider, root)))
    throw new Error('provider 를 찾을 수 없습니다')
  return writeHarnessSettings(engine, provider, settingsJson, root)
}

export function readHarnessSettings(
  key: string,
  root: string = orcaConfigDir()
): HarnessSettingsReadResult {
  const { engine, provider } = parseHarnessSettingsKey(key)
  const path = settingsPath(engine, provider, root)
  return {
    key: providerKeyOf(engine, provider),
    engine,
    provider,
    settingsJson: readFileSync(path, 'utf8')
  }
}

export function deleteHarnessSettings(key: string, root: string = orcaConfigDir()): void {
  const { engine, provider } = parseHarnessSettingsKey(key)
  const dir = providerDir(engine, provider, root)
  if (!existsSync(dir)) throw new Error('provider 를 찾을 수 없습니다')
  rmSync(dir, { recursive: true, force: true })
}
