import type { NormalizedEvent } from '../../../shared/ipc'
import type { ClaudePermissionMode } from '../../../shared/permission-mode'
import type { ResolvedProviderSettings } from '../../adapters/provider-config'
import type { TurnRequest } from '../../adapters/turn'
import type { LiveTurn } from '../../adapters/types'
import type { ManagedRuntime, RuntimeSessionAdapter } from '../../contracts/ports'
import { getLogger } from '../../infra/log/registry'
import {
  SessionRuntimeStatus,
  type AbortCause,
  type SessionRuntimeState
} from '../../contracts/session-state'

// close 정책 2종(decision ⑳ → 0067 개정) — 'persistent' 는 **장수명 세션 채널**: 어댑터가
// pushTurn 을 구현하면 한 번의 spawn(query/서브프로세스)이 세션 수명(LRU 축출·프로그램 종료·
// respawn 경계·에러) 동안 살아남아 후속 턴을 이어받는다. 'oneshot' 또는 pushTurn 미구현
// 어댑터(mock)는 턴-스코프(매 턴 fresh)로 동작한다.
export type ClosePolicy = 'oneshot' | 'persistent'

const EMPTY_EVENTS: AsyncIterable<NormalizedEvent> = {
  [Symbol.asyncIterator](): AsyncIterator<NormalizedEvent> {
    return { next: async () => ({ done: true, value: undefined as never }) }
  }
}

function isTerminal(ev: NormalizedEvent): boolean {
  return ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted'
}

// 0143 — 백그라운드 스코프 이벤트인가: 서브에이전트 child(parentToolRunId)와 task 진행 신호
// (subagent.task)는 CLI 메인 루프의 턴 경계 **밖에서도**(백그라운드 태스크 동시 실행) 흐른다.
// cliBusy(메인 루프 mid-turn) 판정에서 제외하지 않으면, 백그라운드 스트리밍만으로 busy 가
// 고착돼 steer 릴리즈 밸브가 태스크 종료까지 영영 안 열린다.
function isBackgroundScoped(ev: NormalizedEvent): boolean {
  if (ev.type === 'subagent.task') return true
  return (ev as { parentToolRunId?: string }).parentToolRunId !== undefined
}

// 턴 프레임 — 채널 pump 가 밀어넣고(consumer 는 TurnCoordinator) terminal 에서 닫히는 이벤트 큐.
// streaming-input 과 같은 wake 패턴. fail 은 채널 스트림 예외를 프레임 소비자에게 전파한다.
class Frame {
  private readonly queue: NormalizedEvent[] = []
  private done = false
  private error: unknown = null
  private wake: (() => void) | null = null

  push(ev: NormalizedEvent): void {
    if (this.done) return
    this.queue.push(ev)
    this.wake?.()
    this.wake = null
  }

  end(): void {
    this.done = true
    this.wake?.()
    this.wake = null
  }

  fail(err: unknown): void {
    this.error = err
    this.end()
  }

  async *iterate(): AsyncIterable<NormalizedEvent> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!
      }
      if (this.done) {
        if (this.error != null) throw this.error
        return
      }
      await new Promise<void>((resolve) => {
        if (this.done || this.queue.length > 0) {
          resolve()
          return
        }
        this.wake = resolve
      })
    }
  }
}

// SessionRuntime: send() 1회 = 턴 프레임 1개(retry 정책은 TurnCoordinator 소유 — 프레임 에러 시
// send() 재호출 = respawn+resume 콜드 패스). 0067: persistent + pushTurn 어댑터는 **단일 채널
// pump** 가 어댑터 스트림을 계속 소비하며 프레임(1 프레임=1 턴)으로 절단한다 — terminal 에서
// 프레임만 닫고 채널(live)은 유지. 프레임 밖 도착 이벤트(CLI 자동 픽업 턴)는 unframed 버퍼에
// 쌓였다가 다음 openFrame() 이 프레임 안으로 흘린다(자동 연속 턴 오픈은 chat-turn 의
// pendingMessages 폴링이 담당).
export class SessionRuntime implements ManagedRuntime {
  private readonly status = new SessionRuntimeStatus()
  private live: LiveTurn | null = null
  // 채널 신호 — spawn 시 어댑터에 넘기는 유일한 abort 신호(턴 신호와 분리, 0067). 채널 폐기
  // (close/teardown)에서만 abort 된다. 턴 취소는 interrupt() 경로(markAborted)로 채널을 살린다.
  private channelController = new AbortController()
  private pumpRunning = false
  private frame: Frame | null = null
  // 0136 — 현재 프레임이 listen 프레임(입력 push 없는 소비)인가. endListenFrame 릴리즈 밸브가
  // 일반 턴 프레임을 오폐쇄하지 않도록 참조를 구분해 든다.
  private listenFrame: Frame | null = null
  // 프레임 조기 이탈(취소/스톨) 후 그 턴의 잔여 이벤트를 terminal 까지 드랍하는 상태. draining
  // 중 send 가 오면 이벤트 소속을 구분할 수 없으므로 채널을 teardown 하고 respawn 한다(안전 열화).
  private draining = false
  private unframed: NormalizedEvent[] = []
  // 0143 — CLI 가 지금 턴(사용자 턴이든 자동/알림 턴이든)을 진행 중인가. routeEvent 가 비-terminal
  // 이벤트에서 true, terminal 에서 false 로 굴린다(draining 경로 포함). endListenFrame 밸브 유예와
  // chat-turn 의 "pushTurn 은 유휴 채널에서만" 가드가 읽는다 — mid-turn push 로 auto-turn 의
  // terminal/에러가 다음 프레임에 오귀속되는 것(steer 세션 사망)을 구조적으로 차단한다.
  private cliBusy = false
  // 현재 턴의 콜백 위임 — 채널 spawn 시 바인딩되는 requestApproval/takeSteerFlush 가 턴을 넘어
  // 재사용되므로, 어댑터에는 고정 래퍼를 주고 실제 콜백은 매 send 마다 여기로 갈아끼운다(0067 W1).
  private delegate: {
    requestApproval?: TurnRequest['requestApproval']
    takeSteerFlush?: TurnRequest['takeSteerFlush']
  } = {}
  // 0125: 채널 spawn 시 어댑터에 주입된 providerSettings 의 불투명 기록 — 내용 해석·비교는
  // 호출자(chat-turn + features/providers 판정) 소관이고 여기선 기록/해제만 한다(0016 중립).
  // spawn 성공 시 갱신, teardown/채널 사망 시 해제 — channelAlive 인 동안만 유효.
  private spawnedSettings: ResolvedProviderSettings | undefined
  // 0128: 채널 spawn 시 어댑터에 넘긴 model — 같은 provider 라도 모델이 스폰 시점과 달라지면
  // (예: sonnet→haiku) chat-turn 이 respawn 을 판정한다. 라이브 setModel(/model)은 이미 스폰된
  // 서브프로세스의 실제 생성 모델을 바꾸지 못하므로(실측), 모델 변경도 콜드 spawn 이 필요하다.
  private spawnedModelValue: string | undefined

  constructor(
    private readonly adapter: RuntimeSessionAdapter,
    private readonly closePolicy: ClosePolicy = 'persistent'
  ) {}

  // Persistent 정책 핸들만 idle 보존·cross-turn 재사용 대상(Supervisor.releaseRuntime 판정).
  get reusable(): boolean {
    return this.closePolicy === 'persistent'
  }

  // 채널(장수명 query) 생존 여부 — chat-turn 이 carryover(채널 사망 시에만) 판정에 읽는다.
  get channelAlive(): boolean {
    return this.pumpRunning && this.live != null
  }

  // 0143 — CLI mid-turn 여부(자동/알림 턴 포함). chat-turn 턴-후 루프가 "held flush(pushTurn)는
  // 유휴 채널에서만" 을 판정한다.
  get channelBusy(): boolean {
    return this.cliBusy
  }

  // 0143 — 프레임 밖 적체(unframed) 존재 여부. 백로그가 있으면 pushTurn 전에 listen 드레인이
  // 먼저 소화해야 새 프레임이 이전 턴 잔여/terminal 을 승계하지 않는다.
  get hasUnframedBacklog(): boolean {
    return this.unframed.length > 0
  }

  // 0125: 살아있는 채널이 스폰될 때 주입된 providerSettings — chat-turn 이 이번 턴 해석본과
  // 내용 비교(providerSettingsChangedSinceSpawn)해 respawn 을 판정한다.
  get spawnedProviderSettings(): ResolvedProviderSettings | undefined {
    return this.spawnedSettings
  }

  // 0128: 살아있는 채널이 스폰될 때 넘긴 model — chat-turn 이 이번 턴 해석 model 과 비교해
  // (같은 provider 내) 모델 변경 respawn 을 판정한다. channelAlive 인 동안만 유효.
  get spawnedModel(): string | undefined {
    return this.spawnedModelValue
  }

  get events(): AsyncIterable<NormalizedEvent> {
    // 인터페이스 호환용(LiveTurn) — 채널 이벤트는 pump 가 소유하므로 외부 소비 금지.
    return this.pumpRunning ? EMPTY_EVENTS : (this.live?.events ?? EMPTY_EVENTS)
  }

  get state(): SessionRuntimeState {
    return this.status.state
  }

  get cancelled(): boolean {
    return this.status.cancelled
  }

  get timedOut(): boolean {
    return this.status.timedOut
  }

  get canSteer(): boolean {
    return this.live?.canSteer === true
  }

  send(req: TurnRequest): AsyncIterable<NormalizedEvent> {
    return this.runAttempt(req)
  }

  // listen 턴(0136) — 입력을 push 하지 않고 프레임만 열어 CLI 가 스스로 여는 자동 턴(백그라운드
  // 서브에이전트 진행·task_notification·완료 알림 턴)을 소비한다. 채널이 없거나 죽었으면 들을
  // 것이 없다 — 즉시 종료(mock/oneshot 포함 자연 무해). 유휴 중 쌓인 백로그(unframed)는
  // openFrame 이 선합류하므로 적체분도 이 프레임으로 배달된다.
  // send() 의 모드 플래그가 아니라 별도 메서드다(0149) — 어댑터 계약에 listen 불리언을 싣지 않는다.
  listen(req: TurnRequest): AsyncIterable<NormalizedEvent> {
    return this.runListen(req)
  }

  private async *runListen(req: TurnRequest): AsyncIterable<NormalizedEvent> {
    this.status.beginSend()
    this.adoptDelegate(req)
    if (!this.pumpRunning || this.live == null) {
      this.status.markLive()
      return
    }
    const frame = this.openFrame()
    this.listenFrame = frame
    try {
      yield* this.consumeFrame(frame)
    } finally {
      if (this.listenFrame === frame) this.listenFrame = null
    }
  }

  private adoptDelegate(req: TurnRequest): void {
    this.delegate = {
      ...(req.requestApproval ? { requestApproval: req.requestApproval } : {}),
      ...(req.takeSteerFlush ? { takeSteerFlush: req.takeSteerFlush } : {})
    }
  }

  private async *runAttempt(req: TurnRequest): AsyncIterable<NormalizedEvent> {
    this.status.beginSend()
    this.adoptDelegate(req)

    // draining(직전 턴 잔여 드랍) 중의 새 턴은 이벤트 소속 구분이 불가 — 채널 respawn(안전 열화).
    if (this.draining) this.teardownChannel()

    // 장수명 채널 생존 → 후속 턴 이어붙이기(프레임 오픈 후 push — 이른 이벤트 유실 방지).
    const live = this.live
    if (live?.pushTurn && this.pumpRunning) {
      const frame = this.openFrame()
      try {
        await live.pushTurn({
          text: req.text,
          ...(req.attachmentTexts ? { attachmentTexts: req.attachmentTexts } : {}),
          ...(req.attachmentImages ? { attachmentImages: req.attachmentImages } : {}),
          ...(req.promptUuid !== undefined ? { promptUuid: req.promptUuid } : {}),
          ...(req.model !== undefined ? { model: req.model } : {}),
          ...(req.permissionMode !== undefined ? { permissionMode: req.permissionMode } : {})
        })
      } catch (err) {
        if (this.frame === frame) this.frame = null
        frame.end()
        if (!this.cancelled && !this.timedOut) this.status.markError(null)
        throw err
      }
      yield* this.consumeFrame(frame)
      return
    }

    // 스폰 — 채널이 없거나 죽었거나 pushTurn 미지원(mock). 콜백은 delegate 래퍼로 치환해
    // 채널이 턴을 넘어도 현재 턴의 콜백이 호출되게 한다. spawn 경계는 카탈로그(0124) 기록 —
    // sendMessage 동기 호출이 spawn 경계이며, 이후 스트림 실패는 chat.turn.failed 가 담당한다.
    const log = getLogger().child('engine')
    log.info('engine.spawn.started', { provider: this.adapter.id })
    let spawned: LiveTurn
    try {
      spawned = this.adapter.sendMessage(this.wrapRequest(req))
    } catch (err) {
      log.error('engine.spawn.failed', err, { provider: this.adapter.id })
      throw err
    }
    log.info('engine.spawn.completed', { provider: this.adapter.id })
    this.live = spawned
    this.spawnedSettings = req.providerSettings
    this.spawnedModelValue = req.model
    if (spawned.pushTurn && this.closePolicy === 'persistent') {
      const frame = this.openFrame()
      this.startPump(spawned)
      yield* this.consumeFrame(frame)
      return
    }
    yield* this.consumeTurnScoped(spawned)
  }

  // 턴-스코프 소비(0067 이전 동작 보존) — terminal 에서 핸들을 닫는다(mock/oneshot).
  private async *consumeTurnScoped(live: LiveTurn): AsyncIterable<NormalizedEvent> {
    let terminal = false
    try {
      for await (const ev of live.events) {
        if (isTerminal(ev)) terminal = true
        yield ev
        if (terminal) {
          live.close()
          this.status.markLive()
        }
      }
      if (!terminal) this.status.markLive()
    } catch (err) {
      if (!this.cancelled && !this.timedOut) this.status.markError(null)
      throw err
    } finally {
      live.close()
      if (this.live === live) this.live = null
    }
  }

  // consumer 조기 이탈(coordinator return/throw) 시 채널은 유지하되 이 턴 잔여를 draining 으로
  // 넘긴다 — 다음 terminal 까지 드랍(routeEvent). 에러 시 상태 전이는 pump(finishPump)가 아니라
  // 소비 측에서 판정한다(cancelled/timedOut 우선).
  private async *consumeFrame(frame: Frame): AsyncIterable<NormalizedEvent> {
    try {
      yield* frame.iterate()
    } catch (err) {
      if (!this.cancelled && !this.timedOut) this.status.markError(null)
      throw err
    } finally {
      if (this.frame === frame) {
        this.frame = null
        this.draining = true
      }
    }
  }

  private openFrame(): Frame {
    const frame = new Frame()
    // 유휴 중 도착한 백로그(CLI 자동 픽업 이벤트)를 새 프레임 앞에 합류 — 유실 방지. terminal 이
    // 섞여 있으면 프레임 안에서 이전 턴 마감이 먼저 흐른다(coordinator 는 후속 이벤트도 소비).
    for (const ev of this.unframed.splice(0)) frame.push(ev)
    this.frame = frame
    return frame
  }

  private startPump(live: LiveTurn): void {
    this.pumpRunning = true
    void (async () => {
      let pumpError: unknown = null
      try {
        for await (const ev of live.events) {
          if (this.live !== live) return // teardown 후 잔여 — stale pump 는 조용히 은퇴
          this.routeEvent(ev)
        }
      } catch (err) {
        pumpError = err
      }
      if (this.live !== live) return
      this.finishPump(pumpError)
    })()
  }

  private routeEvent(ev: NormalizedEvent): void {
    const terminal = isTerminal(ev)
    // CLI 메인 루프 mid-turn 추적(0143) — 어떤 경로(프레임/드레인/unframed)든 터미널 = 유휴 복귀,
    // 비-terminal 은 백그라운드 스코프(child·subagent.task)를 제외하고 진행 중으로 굴린다.
    if (terminal) this.cliBusy = false
    else if (!isBackgroundScoped(ev)) this.cliBusy = true
    if (this.draining) {
      // 조기 이탈한 턴의 잔여 — terminal 에서 드레인 종료, 채널 유휴 복귀.
      if (terminal) {
        this.draining = false
        this.status.markLive()
      }
      return
    }
    const frame = this.frame
    if (frame) {
      frame.push(ev)
      if (terminal) {
        this.frame = null
        frame.end()
        this.status.markLive()
      }
      return
    }
    // 프레임 밖 — CLI 가 자기 큐 잔존분을 자동 픽업해 시작한 턴(0067 W3 에서 자동 프레임 오픈).
    this.unframed.push(ev)
  }

  // 채널 스트림 종료(정상=입력 close/서브프로세스 종료, 예외=스트림 에러) — 활성 프레임을 마감
  // 하고 채널을 내린다. 다음 send 는 spawn(resume) 콜드 패스.
  private finishPump(err: unknown): void {
    this.pumpRunning = false
    this.draining = false
    this.cliBusy = false
    const frame = this.frame
    this.frame = null
    if (frame) {
      if (err != null) frame.fail(err)
      else frame.end() // terminal 없이 종료 — coordinator 가 합성 telemetry 로 마감
    } else if (err != null) {
      getLogger()
        .child('engine')
        .warn('engine.channel.error', {
          provider: this.adapter.id,
          idle: true,
          message: String(err)
        })
    }
    this.live?.close()
    this.live = null
    this.spawnedSettings = undefined
    this.spawnedModelValue = undefined
    getLogger()
      .child('engine')
      .info('engine.channel.teardown', { provider: this.adapter.id, reason: 'stream-ended' })
  }

  // listen 프레임 강제 종료(0136 릴리즈 밸브) — busy send(held 예약)가 게이트 훅(PostToolBatch)
  // 없이도 즉시 자동 연속 턴으로 전환되도록 프레임만 닫는다. draining 을 세우지 않으므로
  // (consumeFrame 의 finally 는 this.frame !== frame 을 보고 통과) 이후 이벤트는 unframed 로
  // 남아 다음 openFrame 백로그 합류로 무손실 이월된다. listen 프레임이 아니면 no-op(일반 턴
  // 프레임 오폐쇄 방지).
  //
  // 0143 유예: CLI 가 자동(알림) 턴을 진행 중(cliBusy)이면 **no-op** — 그 턴의 terminal 이 listen
  // 프레임을 자연 마감하고 턴-후 루프가 held 를 flush 한다. mid-turn 에 프레임을 닫고 pushTurn
  // 하면 auto-turn 의 잔여/terminal 이 steer 프레임으로 오귀속돼(steer 세션 사망) 됐었다.
  endListenFrame(): void {
    const frame = this.frame
    if (frame == null || frame !== this.listenFrame) return
    if (this.cliBusy) return
    this.frame = null
    this.listenFrame = null
    frame.end()
    this.status.markLive()
  }

  // 채널 강제 해체(respawn 경계·draining 충돌) — 상태머신은 건드리지 않는다(close 와 구분).
  // 0118: spawn-바운드 옵션(env·providerSettings) 변경 respawn 경계는 호출자(chat-turn)가
  // 선언한다 — 여기선 채널만 내리고, 다음 send 가 spawn(resume) 콜드 패스를 탄다.
  teardownChannel(): void {
    // 살아있던 채널의 강제 해체만 기록한다(무채널 close 반복은 소음).
    if (this.live !== null || this.pumpRunning) {
      getLogger()
        .child('engine')
        .info('engine.channel.teardown', { provider: this.adapter.id, reason: 'forced' })
    }
    this.channelController.abort()
    this.channelController = new AbortController()
    const frame = this.frame
    this.frame = null
    frame?.end()
    this.draining = false
    this.cliBusy = false
    this.unframed = []
    this.pumpRunning = false
    this.live?.close()
    this.live = null
    this.spawnedSettings = undefined
    this.spawnedModelValue = undefined
  }

  // 어댑터에 넘기는 요청 — 신호는 채널 신호로 치환(턴 신호와 분리), 콜백은 delegate 래퍼로 치환.
  private wrapRequest(req: TurnRequest): TurnRequest {
    return {
      ...req,
      signal: this.channelController.signal,
      ...(req.requestApproval
        ? {
            requestApproval: (action, signal) => {
              const current = this.delegate.requestApproval
              if (current) return current(action, signal)
              return Promise.resolve({ behavior: 'deny' as const })
            }
          }
        : {}),
      ...(req.takeSteerFlush ? { takeSteerFlush: () => this.delegate.takeSteerFlush?.() } : {})
    }
  }

  close(): void {
    this.teardownChannel()
    this.status.close()
  }

  // 턴 중단 표시 — 장수명 채널은 interrupt(채널 생존, 0067 AC3)로 현재 턴만 멈추고 활성 프레임을
  // 닫는다(잔여는 draining 이 terminal 까지 흡수). 턴-스코프(mock/oneshot)는 채널 신호 abort 로
  // 서브프로세스를 죽인다(현행 취소 의미 보존).
  markAborted(cause: Exclude<AbortCause, null>): void {
    this.status.markInterrupting(cause)
    if (this.pumpRunning && this.live) {
      void this.live.interrupt().catch(() => {})
      const frame = this.frame
      if (frame) {
        this.frame = null
        this.draining = true
        frame.end()
      }
      return
    }
    this.channelController.abort()
  }

  async setPermissionMode(mode: ClaudePermissionMode): Promise<void> {
    await this.live?.setPermissionMode(mode)
  }

  async interrupt(): Promise<void> {
    this.markAborted('user_cancelled')
  }

  async setModel(model?: string): Promise<void> {
    await this.live?.setModel(model)
  }

  async stopTask(taskId: string): Promise<void> {
    await this.live?.stopTask(taskId)
  }

  async backgroundTask(toolUseId: string): Promise<boolean> {
    return (await this.live?.backgroundTask(toolUseId)) ?? false
  }
}
