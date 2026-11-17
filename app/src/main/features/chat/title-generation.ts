// 세션 자동 제목 생성 (handoff 0004) — 새 세션 첫 턴 종료 후 저가 모델 1-shot 으로 요약해
// 절단 제목을 in-place 교체한다. fire-and-forget, 실패는 warn 만(graceful degrade).

import type { SessionTitleSource } from '../../infra/db/types'
import type { RuntimeTitleAdapter } from '../../contracts/ports'
import type { ResolvedHarnessSettings } from '../../adapters/common/harness-config'
import { normalizeTitle, shouldGenerateTitle, titlePrompt } from '../../features/chat/title'
import { broadcastSessionTitle } from '../../infra/ipc/send'
import { getLogger } from '../../infra/log/registry'
import type { TurnContext } from '../../contracts/turn'

// 제목이 읽고 쓰는 세션 메타 — 실행 쪽에서는 데이터 호스트 요청이다(0324 EP-16).
export interface TitleStore {
  getTitleSource(sessionId: string): SessionTitleSource | null | Promise<SessionTitleSource | null>
  updateSessionTitleAuto(
    sessionId: string,
    title: string,
    updatedAt: number
  ): boolean | Promise<boolean>
}

export class TitleGenerator {
  private disposed = false
  private readonly pending = new Map<AbortController, ReturnType<typeof setTimeout>>()

  constructor(private readonly db: TitleStore) {}

  maybeStart(turn: TurnContext): void {
    if (this.disposed) return
    // 제목의 출처는 DB 에 있어 물어야 안다 — 그 밖의 조건을 먼저 보고, 시작 표시를 묻기 전에 세운다.
    // 답을 기다리는 사이 같은 턴의 다음 이벤트가 생성을 한 번 더 시작하면 안 된다.
    if (
      !shouldGenerateTitle({
        isNewSession: turn.isNewSession,
        titleSource: null,
        alreadyStarted: turn.titleGenerationStarted,
        sessionId: turn.dbSessionId,
        firstUserText: turn.firstUserText
      })
    ) {
      return
    }
    turn.titleGenerationStarted = true
    void this.generate({
      sessionId: turn.dbSessionId!,
      firstUserText: turn.firstUserText,
      cwd: turn.cwd,
      adapter: turn.titleAdapter,
      providerSettings: turn.titleSettings,
      env: turn.titleEnv,
      model: turn.titleModel
    })
  }

  dispose(): void {
    this.disposed = true
    for (const [controller, timeout] of this.pending) {
      clearTimeout(timeout)
      controller.abort()
    }
    this.pending.clear()
  }

  private async generate(req: {
    sessionId: string
    firstUserText: string
    cwd: string
    adapter: RuntimeTitleAdapter
    providerSettings?: ResolvedHarnessSettings
    env?: Record<string, string>
    model?: string
  }): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    this.pending.set(controller, timeout)
    try {
      // 사용자가 이미 이름을 바꾼 세션은 건드리지 않는다.
      if ((await this.db.getTitleSource(req.sessionId)) === 'user') return
      if (this.disposed) return
      const raw = await req.adapter.complete({
        prompt: titlePrompt(req.firstUserText),
        cwd: req.cwd,
        signal: controller.signal,
        providerSettings: req.providerSettings,
        env: req.env,
        ...(req.model ? { model: req.model } : {})
      })
      // 종료 시 abort를 무시하고 resolve하는 adapter도 닫힌 DB/renderer에 쓰면 안 된다.
      if (this.disposed) return
      const title = normalizeTitle(raw)
      if (!title) return
      const updated = await this.db.updateSessionTitleAuto(req.sessionId, title, Date.now())
      if (updated && !this.disposed) broadcastSessionTitle({ sessionId: req.sessionId, title })
    } catch (err) {
      if (this.disposed) return
      getLogger()
        .child('chat')
        .warn('chat.title.generation-failed', { sessionId: req.sessionId, message: String(err) })
    } finally {
      clearTimeout(timeout)
      this.pending.delete(controller)
    }
  }
}
