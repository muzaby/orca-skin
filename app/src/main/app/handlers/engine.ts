import {
  CHANNELS,
  CreateEngineSchema,
  DeleteEngineSchema,
  ImportEngineUserSettingsSchema,
  ReadEngineSchema,
  UpdateEngineSchema,
  type EngineReadResult,
  type EngineUserSettingsResult,
  type EngineWriteResult
} from '../../../shared/protocol'
import { HARNESS_IDS } from '../../../shared/harness'
import { harnessModule } from '../harnesses/registry'
import {
  addHarnessSettings,
  deleteHarnessSettings,
  readHarnessSettings,
  updateHarnessSettings
} from '../../features/harnesses/common/settings-write'
import type { AgentContext, HarnessConfigPort } from '../context'
import { handle } from '../../infra/ipc/handle'
import {
  canonicalProviderKey,
  parseProviderKey,
  providerKeyOf
} from '../../infra/config/provider-key'

interface EngineHandlerContext extends Pick<AgentContext, 'deployExtensions'> {
  // 설정 트리 캐시·실행 구성 캐시·카탈로그는 데이터 호스트에 있다(0324 F2).
  harness: Pick<HarnessConfigPort, 'invalidate' | 'isReadOnly'>
}

async function refreshHarnessSettings(ctx: EngineHandlerContext, key: string): Promise<void> {
  try {
    if (parseProviderKey(key, [...HARNESS_IDS])?.adapter === 'claude')
      await ctx.deployExtensions({ throwOnFailure: true })
  } finally {
    // **두 cache 를 함께 비운다** (0188) — settings 만 비우면 동적 runtime config 가 옛
    // sourceRevision 기준 값을 warm hit 로 계속 돌려준다. 카탈로그도 함께 다시 맞춘다.
    await ctx.harness.invalidate(key)
  }
}

export function registerEngineHandlers(ctx: EngineHandlerContext): void {
  const assertMutable = async (key: string): Promise<string> => {
    const canonical = canonicalProviderKey(key, [...HARNESS_IDS])
    if (await ctx.harness.isReadOnly(canonical)) {
      throw new Error(`runtime-managed engine is read-only: ${canonical}`)
    }
    return canonical
  }
  handle(
    CHANNELS.engineAdd,
    CreateEngineSchema,
    'reject',
    async (req): Promise<EngineWriteResult> => {
      const canonical = await assertMutable(providerKeyOf(req.engine, req.provider))
      const result = addHarnessSettings(req.engine, req.provider, req.settingsJson)
      await refreshHarnessSettings(ctx, canonical)
      return result
    }
  )

  handle(
    CHANNELS.engineUpdate,
    UpdateEngineSchema,
    'reject',
    async (req): Promise<EngineWriteResult> => {
      const canonical = await assertMutable(req.key)
      const result = updateHarnessSettings(req.key, req.settingsJson)
      await refreshHarnessSettings(ctx, canonical)
      return result
    }
  )

  handle(CHANNELS.engineDelete, DeleteEngineSchema, 'reject', async (req): Promise<void> => {
    const canonical = await assertMutable(req.key)
    deleteHarnessSettings(req.key)
    await refreshHarnessSettings(ctx, canonical)
  })

  handle(
    CHANNELS.engineRead,
    ReadEngineSchema,
    'reject',
    async (req): Promise<EngineReadResult> => {
      await assertMutable(req.key)
      return readHarnessSettings(req.key)
    }
  )

  handle(
    CHANNELS.engineImportUserSettings,
    ImportEngineUserSettingsSchema,
    'reject',
    ({ engine }): EngineUserSettingsResult => harnessModule(engine).readUserSettings()
  )
}
