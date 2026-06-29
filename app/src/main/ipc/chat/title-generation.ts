// 세션 자동 제목 생성 (handoff 0004) — 새 세션 첫 턴 종료 후 저가 모델 1-shot 으로 요약해
// 절단 제목을 in-place 교체한다. fire-and-forget, 실패는 warn 만(graceful degrade).

import type { DbQueries } from '../../db'
import type { RuntimeTitleAdapter } from '../../lifecycle/ports'
import type { ResolvedProviderSettings } from '../../settings/provider-settings'
import { normalizeTitle, shouldGenerateTitle, titlePrompt } from '../../title/title'
import { broadcastSessionTitle } from '../context'
import type { InflightTurn } from './turn-registry'

export class TitleGenerator {
  constructor(private readonly db: DbQueries) {}

  maybeStart(turn: InflightTurn): void {
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

  private async generate(req: {
    sessionId: string
    firstUserText: string
    cwd: string
    adapter: RuntimeTitleAdapter
    providerSettings?: ResolvedProviderSettings
    env?: Record<string, string>
    model?: string
  }): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
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
      const title = normalizeTitle(raw)
      if (!title) return
      const updated = this.db.updateSessionTitleAuto(req.sessionId, title, Date.now())
      if (updated) broadcastSessionTitle({ sessionId: req.sessionId, title })
    } catch (err) {
      console.warn('[session-title] 자동 제목 생성 실패:', err)
    } finally {
      clearTimeout(timeout)
    }
  }
}
