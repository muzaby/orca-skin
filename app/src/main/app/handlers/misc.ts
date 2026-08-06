// 소형 도메인 핸들러 묶음 — backend / agent / install / notify / debug(dev 전용).
//
// 0179 에서 skills·files·cost·settings 를 각 파일로 내보냈다. 여기 남은 다섯은 채널이 1~2개씩이고
// 서로 이웃할 이유는 없지만 각자 파일을 가질 만큼도 아니다 — 더 쪼개면 파일만 늘고 읽는 곳은
// 그대로다. 어느 하나가 커지면 그때 나간다.

import {
  CHANNELS,
  DebugMockPatchSchema,
  NotifyShowSchema,
  StartInstallSchema,
  type AgentEnvironment,
  type BackendListResult,
  type DebugMockState
} from '../../../shared/protocol'
import { BrowserWindow, Notification } from 'electron'
import { toAgentEnvironments } from '../../features/providers/provider-settings'
import type { RouterContext } from '../context'
import { sendInstallStatus, setWireLog } from '../../infra/ipc/send'
import { setWireSink } from '../../infra/ipc/wire-log'
import { handle, handlePlain } from '../../infra/ipc/handle'
import { getLogger, setConsoleMirror } from '../../infra/log'
import { getOrcaConfig } from '../../infra/config/orca-config'

export function registerMiscHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.backendList, (): BackendListResult => {
    // 능력 서술자를 computed-on-the-fly 로 각 엔트리에 부착(DB 미관여 — §4). capabilities 는
    // 백엔드의 함수(세션별 데이터 아님)라 영속하지 않고 매 응답에 다시 계산해 붙인다.
    const descriptors = ctx.registry.describeAll()
    const backends = ctx.registry.list().map((b) => ({ ...b, capabilities: descriptors[b.id] }))
    const active = ctx.registry.getActiveId() ?? undefined
    return { backends, ...(active ? { active } : {}) }
  })

  // 원천 = sources/settings/<adapter>/ 트리 (handoff 0014 — 구 orca.json agents[] 대체).
  // 페이로드 shape(AgentEnvironment)는 0010 과 동일 유지 — renderer ModelMenu 변경 0.
  handlePlain(CHANNELS.agentList, (): AgentEnvironment[] => {
    const supported = ctx.registry.list().map((adapter) => adapter.id)
    const entries = ctx.providerSettings
      .adapters()
      .flatMap((adapter) => ctx.providerSettings.list(adapter))
    return toAgentEnvironments(entries, supported)
  })

  // 백엔드 설치 — 어댑터의 install() 스트림을 renderer 로 중계하고 완료 후 설치 상태를 갱신한다.
  handle(CHANNELS.installStart, StartInstallSchema, 'reject', async (req, event): Promise<void> => {
    const adapter = ctx.registry.get(req.backend)
    if (!adapter) {
      sendInstallStatus(event.sender, {
        step: 'failed',
        error: `Unknown backend: ${req.backend}`,
        done: true
      })
      return
    }
    for await (const st of adapter.install()) {
      sendInstallStatus(event.sender, st)
    }
    await ctx.registry.refreshInstallState()
  })

  // 응답완료 등 OS 네이티브 알림. 렌더러는 토글(notifyOnComplete)만 확인해 요청하고,
  // "창 비활성일 때만" 게이트는 여기(main)가 담당한다(포커스 판정의 authoritative 출처).
  handle(CHANNELS.notifyShow, NotifyShowSchema, 'reject', (req, event): void => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isFocused()) return
    if (Notification.isSupported()) {
      new Notification({ title: req.title, body: req.body }).show()
    }
  })

  if (import.meta.env.DEV) {
    // DEV "로그" 스위치 통합 게이트(0124 AC12) — wire 이벤트 debug 기록과 콘솔 미러를 함께 제어.
    // DEV sink 는 풀 payload 를 남긴다(개발 계측, 무회귀). 델타 2종 필터는 wire-log 내부가 소유한다.
    setWireSink((label, data) =>
      getLogger().child('ipc').debug('ipc.wire.event', { type: label, payload: data })
    )
    const applyLogSwitch = (on: boolean): void => {
      setWireLog(on)
      setConsoleMirror(on)
    }
    applyLogSwitch(ctx.debugMock.log)
    handlePlain(CHANNELS.debugGetMock, (): DebugMockState => ({ ...ctx.debugMock }))
    handle(CHANNELS.debugSetMock, DebugMockPatchSchema, 'reject', (patch): DebugMockState => {
      Object.assign(ctx.debugMock, patch)
      applyLogSwitch(ctx.debugMock.log)
      return { ...ctx.debugMock }
    })
  } else if (getOrcaConfig().debug === true) {
    // prod: orca.json "debug":true 면 wire 이벤트를 파일에 남긴다(0144) — 메시지 본문 제거는
    // redact 옵션으로 선언하고 wire-log 가 적용한다(0149). 파일 레벨을 debug 로 올리는 것은
    // bootstrap 의 setLogDebug 담당(레벨이 info 면 이 debug 레코드는 드롭됨).
    setWireSink(
      (label, data) =>
        getLogger().child('ipc').debug('ipc.wire.event', { type: label, payload: data }),
      { redact: true }
    )
    setWireLog(true)
  }
}
