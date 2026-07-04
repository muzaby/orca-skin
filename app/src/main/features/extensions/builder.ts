// ExtensionBuilder — Extension 계층 조립기. 정규 소스(DB 지침 · McpStore · 스킬 스캔)를 읽어 백엔드
// 중립 TurnExtensions 로 조립한다. 어댑터/백엔드를 전혀 모른다 — 어댑트(claude 타깃 변환·
// ${VAR} 확장)는 전적으로 어댑터 책임. router 에 흩어져 있던 지침 조회를 이리로 이주해
// "이 확장 리소스는 어디서 조립하지?"를 단일 위치로 모은다 (설계검토 §9 1단계).
//
// systemPromptAppend = 프로젝트 지침(DB). 세션마다·매 턴 가변이라 여기서 매 턴 조회한다.
// (정적 정책 append 체인 prompts/ 는 handoff 0062 에서 제거 — 빈 레지스트리 데드코드였다.)
//

import type { DbQueries } from '../../infra/db'
import type { McpStore } from './mcp/store'
import type { SkillInfo } from '../../../shared/ipc'
import type { TurnExtensions } from '../../adapters/turn'

export class ExtensionBuilder {
  constructor(
    private readonly db: DbQueries,
    private readonly mcp: McpStore,
    private readonly skills: () => SkillInfo[],
    private readonly pluginRoot?: () => string | undefined
  ) {}

  // sessionId 가 있으면 resume 경로(세션→프로젝트 지침 조회), 없으면 새 채팅(projectId 직접 조회).
  // 새 채팅이면 projectId 를, resume 면 null 을 넘긴다.
  build(sessionId: string | null, projectId: string | null): TurnExtensions {
    // 프로젝트 지침 조회. 매 턴 1회 prepared statement — DB SSOT, 캐시 없음(지침 편집이 같은
    // 세션의 다음 메시지부터 즉시 반영). resume 경로는 세션 바인딩으로, 새 채팅은 projectId 로.
    let instructions: string | undefined
    if (sessionId) {
      const ins = this.db.getProjectInstructionsForSession(sessionId)
      if (ins && ins.trim() !== '') instructions = ins
    } else if (projectId) {
      const p = this.db.getProject(projectId)
      if (p && p.instructions.trim() !== '') instructions = p.instructions
    }

    // 시스템 프롬프트 append = 프로젝트 지침(있으면). 정적 정책 append 체인은 제거됐다(0062).
    const systemPromptAppend = instructions ?? ''

    const pluginRoot = this.pluginRoot?.()

    return {
      // 미확장 정규형 — Claude 는 plugin .mcp.json 렌더 경로로 소비한다.
      mcp: this.mcp.enabledConfig(),
      ...(pluginRoot ? { pluginRoot } : {}),
      // 가시화 메타 (어댑트는 어댑터의 항상-on skills 경로가 구동).
      skills: this.skills(),
      // 현재 hooks 소스는 비어 있음 → adaptHooks 가 {} → options.hooks 미주입.
      hooks: { normalized: {} },
      systemPromptAppend
    }
  }
}
