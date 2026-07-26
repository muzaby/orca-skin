// 턴의 "주 모델" 귀속 (순수 — L0, 양 프로세스 안전).
//
// 한 턴에 여러 모델이 등장한다(대화 모델 + 동시 실행 제목 모델 등). 도넛 분모(컨텍스트 윈도)와
// telemetry.model 은 그중 **실사용량이 가장 큰 모델**에 귀속한다 — 소량만 쓰는 제목 haiku 가
// 자동 배제된다(0141: 입력 매칭 폐기, SDK 출력만으로 선택).
//
// 0149: 라이브 경로(adapters/claude-map)와 복원 경로(features/usage/usage-map)가 각자 구현을
// 갖고 있었고 점수식이 실제로 달랐다(라이브=input+cacheRead+cacheCreation, 복원=input only).
// 같은 턴이 라이브일 때와 재로드 후에 다른 주 모델로 귀속되면 도넛 분모가 1M↔200k 로 뒤집힌다.
// adapters 는 features 를 import 할 수 없으므로 공통 지점은 shared 다.

export interface PrimaryModelUsage {
  inputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

// 컨텍스트 점유량 = input + cache_read + cache_creation. output 은 컨텍스트를 차지하지 않으므로
// 주 모델 판정에서 제외한다(hasContextTokens 와 같은 정의).
export function primaryModelScore(usage: PrimaryModelUsage): number {
  return (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0)
}

// 전부 0(사용량 미상)이면 첫 키(삽입 순서)를 유지한다.
export function pickPrimaryModel(
  modelUsage: Record<string, PrimaryModelUsage>
): string | undefined {
  let bestKey: string | undefined
  let bestScore = -1
  for (const [key, usage] of Object.entries(modelUsage)) {
    const score = primaryModelScore(usage)
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }
  return bestKey
}
