// binding 레코드 형상 검사 (0170) — **순수 함수만**. electron·fs 의존 0.
//
// 파일 어댑터(`binding-store-file.ts`)에서 떼어낸 이유는 하나다: 그 파일이 `electron-store` 를
// import 하는 순간 vitest 가 electron 을 로드하려다 죽는다(제약 환경 베이스라인). 형상 검사가
// 이 어댑터의 **유일한 판단**이라, I/O 뒤에 숨기면 검증할 수 없다.
//
// 읽기는 fail-open 이 아니라 **fail-empty** 다. 손상된 레코드 하나로 앱이 못 뜨는 것이 최악이므로
// 그 레코드만 버린다 — 사용자는 재입력만 하면 된다.

import type { AuthBindingInfo } from '../../../shared/ipc'

export function parseBindingRecords(raw: unknown): AuthBindingInfo[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isBindingRecord)
}

function isBindingRecord(value: unknown): value is AuthBindingInfo {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<AuthBindingInfo>
  if (typeof record.id !== 'string' || record.id === '') return false
  if (typeof record.pluginId !== 'string' || typeof record.providerId !== 'string') return false
  if (typeof record.mechanism !== 'string' || typeof record.status !== 'string') return false
  if (typeof record.createdAt !== 'number') return false
  return isTarget(record.target) && isArtifact(record.artifact)
}

function isTarget(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const target = value as { kind?: unknown; applicationId?: unknown; connectorId?: unknown }
  if (target.kind === 'application') return typeof target.applicationId === 'string'
  if (target.kind === 'connector') return typeof target.connectorId === 'string'
  return false
}

function isArtifact(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  return typeof (value as { kind?: unknown }).kind === 'string'
}
