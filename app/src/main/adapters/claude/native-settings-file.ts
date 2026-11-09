// Claude 설정·manifest 읽기 정책(SSOT) — spawn(동기)과 목록(비동기)이 같은 결과를 본다.
//
//   없음·빈 내용(0바이트·공백·BOM만·`null`) → `{}` · 알림 없음 (`parseJsonObject` 빈 내용 규칙)
//   JSON 객체                               → 그대로 사용
//   그 밖 전부(읽기 오류·파싱 실패·비객체)  → CLI 처럼 그 파일만 빼고 계속 + 경고
//
// 설정 문서는 "그 파일 없음"(`{}`)과 같은 결과가 되고, plugin.json 은 그 플러그인을 제외하도록
// `undefined` 를 돌려준다. 경고는 경로와 사유만 싣고 파일 내용은 싣지 않으며, 같은 파일 상태
// (경로 + 사유 + errno 또는 내용 sha256)당 한 번만 낸다 — 다음 전송·창 포커스마다 다시 읽기 때문이다.
// 쓰기를 지배하는 읽기(`plugin-state.ts`·`project-settings.ts`)는 이 모듈을 쓰지 않는다(엄격 유지).

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isRecord } from '../../../shared/obj'
import { parseJsonObject } from '../../infra/config/json-file'
import { reportError } from '../../infra/error-report'

type Kind = 'settings' | 'manifest'
type Outcome = { ok: true; value: Record<string, unknown> } | { ok: false }

class InvalidJson extends Error {
  constructor(readonly reason: 'parse' | 'shape') {
    super(reason)
  }
}

/** Last warned signature per file. Process memory: a restart warns again once. */
const warned = new Map<string, string>()

const errnoOf = (error: unknown): string =>
  isRecord(error) && typeof error.code === 'string' ? error.code : 'unknown'

function warn(file: string, kind: Kind, reason: string, signature: string): void {
  if (warned.get(file) === signature) return
  warned.set(file, signature)
  reportError({
    event: 'claude.native-settings.skipped',
    scope: 'claude',
    title: 'configInvalid',
    level: 'warn',
    detail:
      kind === 'manifest'
        ? `Claude 플러그인 설정을 읽지 못해 이 플러그인을 제외했습니다: ${file}`
        : `Claude 설정 파일을 읽지 못해 이 파일 없이 진행합니다: ${file}`,
    data: { file, reason }
  })
}

function decide(file: string, kind: Kind, text: string | undefined, error?: unknown): Outcome {
  if (error !== undefined) {
    const code = errnoOf(error)
    if (code === 'ENOENT') {
      warned.delete(file)
      return { ok: true, value: {} }
    }
    warn(file, kind, 'read', `read:${code}`)
    return { ok: false }
  }
  try {
    const value = parseJsonObject(text, (reason) => new InvalidJson(reason))
    warned.delete(file)
    return { ok: true, value }
  } catch (failure) {
    const reason = failure instanceof InvalidJson ? failure.reason : 'parse'
    const digest = createHash('sha256')
      .update(text ?? '')
      .digest('hex')
    warn(file, kind, reason, `${reason}:${digest}`)
    return { ok: false }
  }
}

function readSync(file: string, kind: Kind): Outcome {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    return decide(file, kind, undefined, error)
  }
  return decide(file, kind, text)
}

async function readAsync(file: string, kind: Kind): Promise<Outcome> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    return decide(file, kind, undefined, error)
  }
  return decide(file, kind, text)
}

const manifestFile = (root: string): string => join(root, '.claude-plugin', 'plugin.json')

/** A Claude settings document. Unreadable content is the same as an absent file. */
export function readClaudeSettingsObject(file: string): Record<string, unknown> {
  const outcome = readSync(file, 'settings')
  return outcome.ok ? outcome.value : {}
}

export async function readClaudeSettingsObjectAsync(
  file: string
): Promise<Record<string, unknown>> {
  const outcome = await readAsync(file, 'settings')
  return outcome.ok ? outcome.value : {}
}

/** A plugin manifest. `undefined` excludes that plugin; an absent manifest is `{}`. */
export function readClaudePluginManifest(root: string): Record<string, unknown> | undefined {
  const outcome = readSync(manifestFile(root), 'manifest')
  return outcome.ok ? outcome.value : undefined
}

export async function readClaudePluginManifestAsync(
  root: string
): Promise<Record<string, unknown> | undefined> {
  const outcome = await readAsync(manifestFile(root), 'manifest')
  return outcome.ok ? outcome.value : undefined
}
