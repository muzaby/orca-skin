export type AdmissionDecision = { accepted: true } | { accepted: false; reason: string }

export function admitOneShotTurn(isDuplicate: boolean): AdmissionDecision {
  return isDuplicate
    ? { accepted: false, reason: '이미 진행 중인 턴이 있습니다. 완료 후 다시 시도하세요.' }
    : { accepted: true }
}
