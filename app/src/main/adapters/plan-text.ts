// 계획 검토 본문과 CLI 반환 입력 해소(0249 ΔV1).
// 경로를 추측하지 않는다(0215 D-004): 이번 턴의 관측된 쓰기 경로 또는 모델이 선언한
// plans 내부 경로만 읽는다. 파일 출처가 없으면 기존 입력 → 이번 턴 서술 → 빈 본문 체인이다.
import path from 'node:path'
import { isRecord } from '../../shared/obj'
import type { PlanFile } from './plan-file'

export interface PlanReviewSources {
  tracked?: PlanFile | null
  declared?: PlanFile | null
  narrative?: string
}

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function normalizedPlan(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trimEnd()
}

function samePath(a: unknown, b: string): boolean {
  return typeof a === 'string' && a.trim() !== '' && path.relative(a, b) === ''
}

export function resolvePlanReview<T>(
  input: T,
  sources: PlanReviewSources = {}
): { plan: string; updatedInput: T | Record<string, unknown> } {
  const injected: Record<string, unknown> = isRecord(input) ? input : {}
  const inputPlan = nonBlank(injected.plan)
  const file = [sources.tracked, sources.declared].find((source) => nonBlank(source?.plan))
  if (file) {
    // CLI는 주입 필드가 달라지면 계획을 사용자 편집으로 저장한다. 정상 입력은 정규화 차이만
    // 있어도 원래 본문과 객체 참조를 보존해 기존 승인 결과를 유지한다(AC21).
    if (
      inputPlan !== undefined &&
      normalizedPlan(inputPlan) === normalizedPlan(file.plan) &&
      samePath(injected.planFilePath, file.planFilePath)
    ) {
      return { plan: inputPlan, updatedInput: input }
    }
    return {
      plan: file.plan,
      updatedInput: { ...injected, plan: file.plan, planFilePath: file.planFilePath }
    }
  }
  // 서술은 표시 폴백이다. 파일 정본이 아니므로 CLI에 계획 필드로 돌려주지 않는다.
  return { plan: inputPlan ?? nonBlank(sources.narrative) ?? '', updatedInput: input }
}
