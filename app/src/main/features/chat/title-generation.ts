// 세션 자동 제목 생성 (handoff 0004) — 새 세션 첫 턴 종료 후 저가 모델 1-shot 으로 요약해
// 절단 제목을 in-place 교체한다. fire-and-forget, 실패는 warn 만(graceful degrade).

import type { DbQueries } from '../../infra/db'
import type { RuntimeTitleAdapter } from '../../contracts/ports'
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'
import { normalizeTitle, shouldGenerateTitle, titlePrompt } from '../../features/chat/title'
import { broadcastSessionTitle } from '../../infra/ipc/send'
import { getLogger } from '../../infra/log/registry'
import type { TurnContext } from '../../contracts/turn'

export class TitleGenerator {
  private disposed = false
  private readonly pending = new Map<AbortController, ReturnType<typeof setTimeout>>()

  constructor(private readonly db: DbQueries) {}

  maybeStart(turn: TurnContext): void {
    if (this.disposed) return
    const titleSource = turn.dbSessionId ? this.db.getTitleSource(turn.dbSessionId) : null
    if (
      !shouldGenerateTitle({
        isNewSession: turn.isNewSession,
        titleSource,
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
      if (this.db.getTitleSource(req.sessionId) === 'user') return
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
      const updated = this.db.updateSessionTitleAuto(req.sessionId, title, Date.now())
      if (updated) broadcastSessionTitle({ sessionId: req.sessionId, title })
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
