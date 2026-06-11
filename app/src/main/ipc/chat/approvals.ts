// 권한 승인 조정자 — canUseTool(AskUserQuestion / ExitPlanMode / 위험 도구) ↔ renderer 응답을
// 잇는 InteractionBroker 와 그 부수 상태("세션 동안 허용" 도구 집합, approvalId→턴 매핑)를
// 소유한다. permissionRespond / permissionSetMode 핸들러도 여기서 등록한다.
//
// 구 모델은 부수효과 대상 턴을 event.sender(WebContents) 로 찾았다 — 턴 레지스트리의
// 세션 키잉 전환에 맞춰 approvalId→턴 매핑으로 교체(멀티세션·다중 창에서도 정확).

import { CHANNELS, type ApprovalResolution, type PermissionRespond } from '../../../shared/ipc'
import { PermissionRespondSchema, SetPermissionModeSchema } from '../../../shared/protocol'
import { toClaudePermissionMode } from '../../../shared/permission-mode'
import { InteractionBroker } from '../../ask/broker'
import type { PermissionModeController } from '../../runtime-events/permission-mode-controller'
import { handle } from '../registry'
import type { InflightTurn, TurnRegistry } from './turn-registry'

export class ApprovalCoordinator {
  private readonly broker = new InteractionBroker<ApprovalResolution>()
  // "세션 동안 허용"으로 부여된 도구 — 같은 세션의 이후 턴에서 카드 없이 자동 허용. 키 =
  // dbSessionId, 값 = 허용된 toolName 집합. 프로세스 메모리에만 보존(영속 안 함).
  private readonly sessionAllowedTools = new Map<string, Set<string>>()
  // 보류 중 승인의 출처 턴 — permissionRespond 의 부수효과(세션 허용 부여·deny+interrupt
  // abort)가 정확한 턴을 향하게 한다. broker settle 시 정리.
  private readonly turnsByApproval = new Map<string, InflightTurn>()

  isSessionAllowed(sessionId: string, toolName: string): boolean {
    return this.sessionAllowedTools.get(sessionId)?.has(toolName) ?? false
  }

  // 승인을 등록하고 renderer 응답(또는 턴 abort = deny)까지 보류한다.
  register(
    approvalId: string,
    turn: InflightTurn,
    signal: AbortSignal
  ): Promise<ApprovalResolution> {
    this.turnsByApproval.set(approvalId, turn)
    return this.broker
      .register(approvalId, signal, { behavior: 'deny' })
      .finally(() => this.turnsByApproval.delete(approvalId))
  }

  // 단일 권한 응답 — renderer 가 ask/plan/tool 승인을 approvalId + ApprovalResolution 으로
  // 회신. broker 가 보류 중이던 canUseTool Promise 를 해소해 query 가 재개된다. 두 가지 부수효과:
  //   ① allow + updatedPermissions(scope:session) → 해당 세션의 sessionAllowedTools 갱신
  //      (같은 세션 이후 턴에서 자동 허용).
  //   ② deny + interrupt → 해당 턴 abort (plan reject 의 turn-abort 동작 보존).
  private respond({ approvalId, resolution }: PermissionRespond): void {
    // resolve 가 finally 정리를 킥하므로 턴 참조는 먼저 확보한다.
    const turn = this.turnsByApproval.get(approvalId)
    this.broker.resolve(approvalId, resolution)

    if (resolution.behavior === 'allow' && resolution.updatedPermissions) {
      const sid = turn?.dbSessionId
      if (sid) {
        const set = this.sessionAllowedTools.get(sid) ?? new Set<string>()
        for (const p of resolution.updatedPermissions) {
          if (p.scope === 'session') set.add(p.toolName)
        }
        this.sessionAllowedTools.set(sid, set)
      }
    }

    if (resolution.behavior === 'deny' && resolution.interrupt) {
      turn?.controller.abort()
    }
  }

  registerHandlers(turns: TurnRegistry<unknown>, permissionModes: PermissionModeController): void {
    handle(CHANNELS.permissionRespond, PermissionRespondSchema, { fallback: undefined }, (req) =>
      this.respond(req)
    )

    // 권한 모드 라이브 전환 (orca:permission:setMode). 두 경로:
    //   ① controller(세션 SSOT) 갱신 — 다음 턴 send 가 이 값을 싣는다.
    //   ② 진행 중 턴(같은 세션)이면 Query.setPermissionMode 로 즉시 전환 — 그 턴의 이후 도구부터 반영.
    handle(
      CHANNELS.permissionSetMode,
      SetPermissionModeSchema,
      { fallback: undefined },
      async ({ sessionId, mode }): Promise<void> => {
        void permissionModes.setMode(sessionId, mode)

        const turn = turns.getBySession(sessionId)
        if (turn?.live) {
          try {
            await turn.live.setPermissionMode(toClaudePermissionMode(mode))
          } catch {
            // 라이브 전환 실패(핸들이 막 닫힘 등)는 무시 — controller 값이 다음 턴에 반영된다.
          }
        }
      }
    )
  }
}
