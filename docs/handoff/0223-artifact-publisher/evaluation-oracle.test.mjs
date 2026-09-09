// 작성자: Codex. 합성 관측의 분류 규칙 시험이며 실제 모델 평가 결과가 아니다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyEvaluation } from './evaluation-oracle.mjs'

const sample = (patch = {}) => ({
  required: ['report.html'], forbidden: ['internal.md'],
  generated: ['report.html'], attempted: ['report.html'],
  stored: ['report.html'], linked: ['report.html'], finished: true,
  ...patch
})

test('완료된 정상 사례: 실제 상대경로 차집합과 누락 분모', () => {
  const result = classifyEvaluation(sample())
  assert.deepEqual(result.publicationOmissions, [])
  assert.deepEqual(result.generationFailures, [])
  assert.deepEqual(result.connectionFailures, [])
  assert.deepEqual(result.eligibleForOmission, ['report.html'])
  assert.equal(result.denominators.omission, 1)
  assert.equal(result.omissionRate, 0)
})

test('생성·선택·검증·저장·연결 실패를 합산하지 않고 각 경로로 구분', () => {
  const result = classifyEvaluation(sample({
    required: ['not-created.md', 'omitted.md', 'save-failed.md', 'unlinked.md'],
    generated: ['omitted.md', 'save-failed.md', 'unlinked.md', 'internal.md', 'invalid.md'],
    attempted: ['save-failed.md', 'unlinked.md', 'internal.md', 'invalid.md'],
    validated: ['save-failed.md', 'unlinked.md', 'internal.md'],
    stored: ['unlinked.md', 'internal.md'], linked: ['internal.md']
  }))
  assert.deepEqual(result.generationFailures, ['not-created.md'])
  assert.deepEqual(result.publicationOmissions, ['omitted.md'])
  assert.deepEqual(result.wrongPublicationAttempts, ['internal.md'])
  assert.deepEqual(result.wrongPublicationsStored, ['internal.md'])
  assert.deepEqual(result.validationFailures, ['invalid.md'])
  assert.deepEqual(result.storageFailures, ['save-failed.md'])
  assert.deepEqual(result.connectionFailures, ['unlinked.md'])
  assert.equal(result.denominators.omission, 3)
  assert.equal(result.omissionRate, 1 / 3)
})

test('중단은 누락 분모 0: 관측한 오선택 시도·확정은 보존', () => {
  const result = classifyEvaluation(sample({
    required: ['report.html', 'not-created.md'],
    attempted: ['internal.md'], stored: ['internal.md'], linked: [], finished: false
  }))
  assert.equal(result.assessment, 'deferred')
  assert.equal(result.denominators.omission, 0)
  assert.equal(result.omissionRate, null)
  assert.deepEqual(result.publicationOmissions, [])
  assert.deepEqual(result.generationFailures, [])
  assert.deepEqual(result.storageFailures, [])
  assert.deepEqual(result.connectionFailures, [])
  assert.deepEqual(result.wrongPublicationAttempts, ['internal.md'])
  assert.deepEqual(result.wrongPublicationsStored, ['internal.md'])
  assert.deepEqual(result.deferredPaths, ['internal.md', 'not-created.md', 'report.html'])
})

test('검증 단계 미관측은 저장 실패로 추정하지 않는다', () => {
  const result = classifyEvaluation(sample({ stored: [], linked: [] }))
  assert.deepEqual(result.storageFailures, [])
  assert.deepEqual(result.validationFailures, [])
  assert.deepEqual(result.unresolvedPublicationFailures, ['report.html'])
  assert.equal(result.assessment, 'deferred')
})

test('상대경로 집합을 정규화·중복 제거하고 금지 집합 밖의 추가 결과는 오게시로 추정하지 않는다', () => {
  const result = classifyEvaluation(sample({
    required: new Set(['./out\\report.html']), generated: ['out/report.html', './out/report.html'],
    attempted: ['out/report.html', 'allowed.md'], stored: ['out/report.html'], linked: ['out/report.html']
  }))
  assert.equal(result.denominators.omission, 1)
  assert.deepEqual(result.wrongPublicationAttempts, [])
  assert.deepEqual(result.observed.generated, ['out/report.html'])
})

test('잘못된 좌표·모순 기대 집합·관측 순서·종료 값은 분류 전에 거절', () => {
  for (const path of ['../report.md', '/report.md', 'C:\\report.md', '//host/report.md', '']) {
    assert.throws(() => classifyEvaluation(sample({ required: [path] })), /INVALID_RELATIVE_PATH/)
  }
  assert.throws(() => classifyEvaluation(sample({ forbidden: ['report.html'] })), /CONFLICTING_EXPECTATIONS/)
  assert.throws(() => classifyEvaluation(sample({ stored: [] })), /INVALID_STAGE_RELATION/)
  assert.throws(() => classifyEvaluation(sample({ finished: undefined })), /INVALID_FINISHED/)
})
