// 사용자 생성 connector 인스턴스 저장소 (0161).
//
// **영속은 주입받는다** (`InstancePersistPort`) — electron-store 를 직접 import 하지 않아
// 전체가 순수 단위 테스트 대상이 된다. 컴포지션 루트가 `SettingsStore` 를 물린다.
//
// 저장 대상은 **비밀이 아닌 설정만**이다. 자격증명은 기존대로 safeStorage vault 에 남는다
// (AUTH-PLAT-008) — 이 파일에 secret 이라는 단어가 나오지 않는 것이 확인 가능한 속성이다.

import { z } from 'zod'
// origin·컨텍스트 경로 규칙의 정본은 shared 다 — IPC 가 거부할 값이 저장소에는 들어가는(또는 그
// 반대의) 어긋남을 없앤다. 문구만 이 자리 말로 붙인다.
import { API_BASE_PATH_PATTERN, isBareOrigin } from '../../../shared/connector-address'
import { deriveConnectorId, isValidConnectorId } from './instance-id'

const OriginSchema = z
  .string()
  .refine(isBareOrigin, 'baseUrl 은 경로 없는 origin 이어야 합니다 (예: https://wiki.corp)')

const ApiBasePathSchema = z
  .string()
  .max(200)
  .refine((raw) => raw === '' || API_BASE_PATH_PATTERN.test(raw), {
    message: 'apiBasePath 는 `/` 로 시작하는 경로여야 합니다'
  })

export const ConnectorInstanceSchema = z.object({
  connectorId: z.string().min(1).max(128),
  templateId: z.string().min(1).max(128),
  label: z.string().min(1).max(200),
  baseUrl: OriginSchema,
  apiBasePath: ApiBasePathSchema.optional()
})

export type ConnectorInstance = z.infer<typeof ConnectorInstanceSchema>

export interface InstancePersistPort {
  read(): unknown
  write(instances: readonly ConnectorInstance[]): void
}

export type CreateInstanceInput = {
  templateId: string
  label: string
  baseUrl: string
  apiBasePath?: string
}

export type CreateInstanceResult =
  | { ok: true; instance: ConnectorInstance }
  | { ok: false; reason: 'invalid_input' | 'already_exists' | 'invalid_id'; detail?: string }

export class ConnectorInstanceStore {
  constructor(private readonly persist: InstancePersistPort) {}

  // 깨진 항목은 **버리고 나머지를 살린다.** 설정 파일은 사람이 편집할 수 있어 한 항목이
  // 부팅 전체를 막으면 안 된다(`infra/settings-store.ts` 의 기존 복원 정신 승계).
  list(): ConnectorInstance[] {
    const raw = this.persist.read()
    if (!Array.isArray(raw)) return []
    return raw.flatMap((entry) => {
      const parsed = ConnectorInstanceSchema.safeParse(entry)
      return parsed.success ? [parsed.data] : []
    })
  }

  get(connectorId: string): ConnectorInstance | undefined {
    return this.list().find((instance) => instance.connectorId === connectorId)
  }

  create(input: CreateInstanceInput): CreateInstanceResult {
    const normalized = {
      templateId: input.templateId.trim(),
      label: input.label.trim(),
      baseUrl: input.baseUrl.trim(),
      apiBasePath: normalizeApiBasePath(input.apiBasePath)
    }

    const connectorId = deriveConnectorId({
      templateId: normalized.templateId,
      baseUrl: normalized.baseUrl,
      ...(normalized.apiBasePath !== undefined ? { apiBasePath: normalized.apiBasePath } : {})
    })
    if (!isValidConnectorId(connectorId)) {
      return { ok: false, reason: 'invalid_id', detail: connectorId }
    }

    const parsed = ConnectorInstanceSchema.safeParse({ ...normalized, connectorId })
    if (!parsed.success) {
      return { ok: false, reason: 'invalid_input', detail: parsed.error.issues[0]?.message }
    }

    const current = this.list()
    // 같은 서버를 두 번 등록할 이유가 없고, 접미사를 붙이면 "ID 는 주소에서 파생된다" 는
    // 성질이 깨진다 — 조용히 두 개를 만들지 않고 거부한다.
    if (current.some((instance) => instance.connectorId === connectorId)) {
      return { ok: false, reason: 'already_exists', detail: connectorId }
    }

    this.persist.write([...current, parsed.data])
    return { ok: true, instance: parsed.data }
  }

  // 없는 ID 를 지워도 오류가 아니다 — 삭제는 멱등해야 재시도가 안전하다.
  remove(connectorId: string): boolean {
    const current = this.list()
    const next = current.filter((instance) => instance.connectorId !== connectorId)
    if (next.length === current.length) return false
    this.persist.write(next)
    return true
  }
}

// `/confluence/`·`confluence`·'' 를 `/confluence`·undefined 로 정규화한다. 배포마다 사람이
// 적는 값이라 형태를 강제하지 않고 흡수한다.
export function normalizeApiBasePath(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '' || trimmed === '/') return undefined
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const withoutTrailing = withLeading.replace(/\/+$/, '')
  return withoutTrailing === '' ? undefined : withoutTrailing
}
