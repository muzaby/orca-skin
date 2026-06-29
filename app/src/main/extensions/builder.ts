// ExtensionBuilder — Extension 계층 조립기. 정규 소스(DB 지침 · McpStore · 스킬 스캔)를 읽어 백엔드
// 중립 TurnExtensions 로 조립한다. 어댑터/백엔드를 전혀 모른다 — 어댑트(claude 타깃 변환·
// ${VAR} 확장)는 전적으로 어댑터 책임. router 에 흩어져 있던 지침 조회 + 정책 append join 을
// 이리로 이주해 "이 확장 리소스는 어디서 조립하지?"를 단일 위치로 모은다 (설계검토 §9 1단계).
//
// stableAppend = prompts/buildAppend 가 startup 에 1회 조립한 정적 정책 본문(현재 python-runtime).
// 프로젝트 지침(DB)은 세션마다·매 턴 가변이라 여기서 매 턴 조회해 그 앞에 결합한다.
//
// env(uv 런타임)는 확장 묶음이 아니라 TurnRequest 직속이라 빌더를 우회한다 — router 가 직접 조립.

import type { DbQueries } from '../db'
import type { McpStore } from '../mcp/store'
import type { SkillInfo } from '../../shared/ipc'
import type { TurnExtensions } from './types'

export class ExtensionBuilder {
  constructor(
    private readonly db: DbQueries,
    private readonly mcp: McpStore,
    private readonly skills: () => SkillInfo[],
    private readonly stableAppend: string
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

    // 정적 정책 본문(python-runtime 등)을 항상 시스템 프롬프트에 합류. 프로젝트 지침이 있으면 그
    // 앞에 둔다(현행 순서 보존 — 가이드 7장 STABLE-first 티어링은 excludeDynamicSections:false 로
    // cross-대화 캐시가 이미 깨져 순서가 무의미. 무회귀 위해 reorder 안 함. system-prompt.md 참조).
    const systemPromptAppend = instructions
      ? `${instructions}\n\n${this.stableAppend}`
      : this.stableAppend

    return {
      // 미확장 정규형 — 어댑터가 자기 resolver 로 확장 후 어댑트.
      mcp: this.mcp.enabledConfig(),
      // 가시화 메타 (어댑트는 어댑터의 항상-on skills 경로가 구동).
      skills: this.skills(),
      // 이번 PR 의 실런타임 경로는 비어 있음 → adaptHooks 가 {} → options.hooks 미주입.
      hooks: { normalized: {} },
      systemPromptAppend
    }
  }
}
