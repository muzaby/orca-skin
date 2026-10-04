import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { resolvePlanReview } from './plan-text'

// 0215 VP-04 (MD-04 ↔ UT) — 계획 본문 해소 체인 3분기.
describe('resolvePlanReview — 파일 없는 0215 해소 체인 (VP-20)', () => {
  it('AT-02 — 주입된 plan 이 있으면 그것이 이긴다 (서술은 쓰이지 않는다)', () => {
    expect(
      resolvePlanReview({ plan: '## 계획\n1. 고친다' }, { narrative: '모델이 말로 한 계획' }).plan
    ).toBe('## 계획\n1. 고친다')
  })

  it('AT-01 — plan 이 없으면 이번 턴 서술을 쓴다', () => {
    expect(resolvePlanReview({}, { narrative: '모델이 말로 한 계획' }).plan).toBe(
      '모델이 말로 한 계획'
    )
    // 필드 자체가 없는 경우와 비문자열인 경우가 같다 — CLI 가 주입하지 않으면 키가 아예 없다.
    expect(resolvePlanReview({ plan: 42 }, { narrative: '모델이 말로 한 계획' }).plan).toBe(
      '모델이 말로 한 계획'
    )
    expect(resolvePlanReview(undefined, { narrative: '모델이 말로 한 계획' }).plan).toBe(
      '모델이 말로 한 계획'
    )
  })

  it('공백만 있는 plan 은 "없음" 이다 — 빈 본문으로 승인 카드를 띄우지 않는다', () => {
    expect(resolvePlanReview({ plan: '   \n  ' }, { narrative: '서술' }).plan).toBe('서술')
  })

  it('AT-03 — 둘 다 없으면 빈 문자열이다 (호출부가 실패로 다룬다)', () => {
    expect(resolvePlanReview({}).plan).toBe('')
    expect(resolvePlanReview({}, { narrative: '   ' }).plan).toBe('')
  })
})

const tracked = { plan: '# 최신 계획\n1. 실행한다', planFilePath: path.resolve('plans/tracked.md') }
const declared = { plan: '# 선언 계획', planFilePath: path.resolve('plans/declared.md') }

describe('0249 VP-13′ — 출처·입력·서술 표', () => {
  const cases = ['tracked', 'declared', 'none'].flatMap((source) =>
    ['empty', 'wrong', 'same'].flatMap((kind) =>
      [false, true].map((narrative) => ({ source, kind, narrative }))
    )
  )
  it.each(cases)('$source / $kind / narrative=$narrative', ({ source, kind, narrative }) => {
    const file = source === 'tracked' ? tracked : source === 'declared' ? declared : undefined
    const input = {
      extra: { preserve: true },
      ...(kind === 'empty'
        ? {}
        : kind === 'same' && file
          ? file
          : { plan: '옛 본문', planFilePath: 'wrong.md' })
    }
    const result = resolvePlanReview(input, {
      ...(source === 'tracked' ? { tracked, declared } : source === 'declared' ? { declared } : {}),
      ...(narrative ? { narrative: '서술' } : {})
    })
    expect(result.plan).toBe(file?.plan ?? ('plan' in input ? input.plan : narrative ? '서술' : ''))
    if (file && kind !== 'same') {
      expect(result.updatedInput).toEqual({ ...input, ...file })
      expect(result.updatedInput).not.toBe(input)
    } else {
      expect(result.updatedInput).toBe(input)
    }
  })

  it('빈 추적 파일은 선언 파일로 내려가고 입력의 다른 필드를 보존한다', () => {
    const input = { allowedPrompts: ['keep'] }
    expect(resolvePlanReview(input, { tracked: { ...tracked, plan: ' \n' }, declared })).toEqual({
      plan: declared.plan,
      updatedInput: { ...input, ...declared }
    })
  })

  it.each([null, undefined, 42, ['not a record']])(
    '비객체 입력 %j도 파일로 안전하게 보정한다',
    (input) => {
      expect(resolvePlanReview(input, { tracked })).toEqual({
        plan: tracked.plan,
        updatedInput: tracked
      })
    }
  )

  it('본문이 같아도 경로가 틀리면 두 필드를 함께 보정한다', () => {
    const input = { plan: tracked.plan, planFilePath: declared.planFilePath }
    expect(resolvePlanReview(input, { tracked }).updatedInput).toEqual(tracked)
  })

  it('경로가 같아도 본문이 틀리면 파일 본문을 반환한다', () => {
    const input = { plan: '오래된 본문', planFilePath: tracked.planFilePath }
    expect(resolvePlanReview(input, { tracked })).toEqual({
      plan: tracked.plan,
      updatedInput: tracked
    })
  })

  it('AC21 — CRLF·BOM·끝 공백만 다르면 본문과 입력 참조를 보존한다', () => {
    const input = {
      plan: '\uFEFF# 최신 계획\r\n1. 실행한다 \r\n',
      planFilePath: path.join(path.dirname(tracked.planFilePath), '.', 'tracked.md')
    }
    const result = resolvePlanReview(input, { tracked })
    expect(result.plan).toBe(input.plan)
    expect(result.updatedInput).toBe(input)
  })

  it.runIf(process.platform === 'win32')(
    'AC21 — win32 경로 대소문자만 다르면 입력 그대로다',
    () => {
      const input = { ...tracked, planFilePath: tracked.planFilePath.toUpperCase() }
      expect(resolvePlanReview(input, { tracked }).updatedInput).toBe(input)
    }
  )

  it('서술만 표시해도 CLI 반환에 plan·planFilePath를 추가하지 않는다', () => {
    const input = { allowedPrompts: [{ tool: 'Bash', prompt: 'run' }] }
    const result = resolvePlanReview(input, { narrative: '서술 계획' })
    expect(result.plan).toBe('서술 계획')
    expect(result.updatedInput).toBe(input)
    expect(result.updatedInput).not.toHaveProperty('plan')
    expect(result.updatedInput).not.toHaveProperty('planFilePath')
  })
})
