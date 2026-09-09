// 작성자: Codex.
// evaluation.md §4 / VP-43: 관측 집합의 차집합만 분류한다. 제품 코드·모델 실행·파일 조사 없음.
// 경로는 동일 실행의 fixture 상대 좌표다. 파일 실체/내용의 정답 판정은 호출자가 먼저 수행한다.

function pathSet(values) {
  if (!Array.isArray(values) && !(values instanceof Set)) throw new Error('INVALID_PATH_SET')
  return new Set([...values].map((value) => {
    if (typeof value !== 'string' || !value || /[\u0000-\u001f:]/u.test(value)) {
      throw new Error('INVALID_RELATIVE_PATH')
    }
    const path = value.replaceAll('\\', '/')
    if (path.startsWith('/') || path.split('/').includes('..')) throw new Error('INVALID_RELATIVE_PATH')
    const normalized = path.split('/').filter((part) => part && part !== '.').join('/')
    if (!normalized) throw new Error('INVALID_RELATIVE_PATH')
    return normalized
  }))
}

const sorted = (set) => [...set].sort()
const difference = (left, right) => new Set([...left].filter((path) => !right.has(path)))
const intersection = (left, right) => new Set([...left].filter((path) => right.has(path)))
function requireSubset(left, right) {
  if (difference(left, right).size) throw new Error('INVALID_STAGE_RELATION')
}

/**
 * required/forbidden/generated/attempted/stored/linked: 상대경로 Array 또는 Set.
 * finished: 게시 기회까지 정상 종료했다는 명시 boolean. 중단·환경 오류·애매한 과업은 false.
 * validated?: 검증 통과가 직접 관측된 집합. 없으면 미저장을 저장 실패로 추정하지 않는다.
 * attempted/stored/linked는 실행 도중 실제 관측 사실이며 finished=false여도 오선택은 보존한다.
 */
export function classifyEvaluation(input) {
  if (typeof input?.finished !== 'boolean') throw new Error('INVALID_FINISHED')
  const required = pathSet(input.required)
  const forbidden = pathSet(input.forbidden)
  const generated = pathSet(input.generated)
  const attempted = pathSet(input.attempted)
  const stored = pathSet(input.stored)
  const linked = pathSet(input.linked)
  const validated = input.validated === undefined ? null : pathSet(input.validated)
  if (intersection(required, forbidden).size) throw new Error('CONFLICTING_EXPECTATIONS')
  requireSubset(linked, stored)
  requireSubset(stored, attempted)
  if (validated) {
    requireSubset(validated, attempted)
    requireSubset(stored, validated)
  }

  const finished = input.finished
  const eligible = finished ? intersection(required, generated) : new Set()
  const omissions = difference(eligible, attempted)
  const unresolved = finished && !validated ? difference(attempted, stored) : new Set()
  const pending = finished ? unresolved : new Set([
    ...difference(required, linked), ...difference(attempted, stored), ...difference(stored, linked)
  ])
  return {
    finished,
    assessment: !finished || unresolved.size ? 'deferred' : 'complete',
    generationFailures: finished ? sorted(difference(required, generated)) : [],
    publicationOmissions: sorted(omissions),
    wrongPublicationAttempts: sorted(intersection(forbidden, attempted)),
    wrongPublicationsStored: sorted(intersection(forbidden, stored)),
    validationFailures: finished && validated ? sorted(difference(attempted, validated)) : [],
    storageFailures: finished && validated ? sorted(difference(validated, stored)) : [],
    connectionFailures: finished ? sorted(difference(stored, linked)) : [],
    unresolvedPublicationFailures: sorted(unresolved),
    deferredPaths: sorted(pending),
    eligibleForOmission: sorted(eligible),
    denominators: { omission: eligible.size, attempts: attempted.size, stored: stored.size },
    omissionRate: eligible.size ? omissions.size / eligible.size : null,
    observed: {
      required: sorted(required), forbidden: sorted(forbidden), generated: sorted(generated),
      attempted: sorted(attempted), validated: validated ? sorted(validated) : null,
      stored: sorted(stored), linked: sorted(linked)
    }
  }
}
