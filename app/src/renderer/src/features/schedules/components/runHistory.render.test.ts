// 실행 이력 — 상태·출처·사유·종료 코드·출력·대화 열기를 렌더 출력으로 본다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SCHEDULE_RUN_ERROR, type ScheduledRun } from '../../../../../shared/scheduled-tasks'
import { ko } from '../../../shared/i18n/resources/ko'
import { runErrorKey } from '../lib/runError'
import { RunHistory } from './RunHistory'

const run = (overrides: Partial<ScheduledRun>): ScheduledRun => ({
  id: 1,
  taskId: 't1',
  origin: 'schedule',
  startedAt: new Date(2026, 0, 5, 9, 0).getTime(),
  finishedAt: null,
  status: 'success',
  error: null,
  sessionId: null,
  exitCode: null,
  output: null,
  outputTruncated: false,
  ...overrides
})

const render = (runs: ScheduledRun[] | null): string =>
  renderToStaticMarkup(createElement(RunHistory, { runs, onOpenSession: () => undefined }))

describe('RunHistory', () => {
  it('keeps a large stored tail out of the collapsed run DOM', () => {
    const output = 'saved-tail'.repeat(7000)
    const html = render([run({ output, outputTruncated: true })])
    expect(html).toContain('<details')
    expect(html).not.toContain('saved-tail')
  })
  it('불러오는 중과 빈 이력을 구별한다', () => {
    expect(render(null)).toContain('불러오는 중…')
    expect(render([])).toContain('아직 실행한 적이 없습니다.')
  })

  it('shell 실행은 종료 코드와 출력을 보인다', () => {
    const html = render([run({ exitCode: 0, output: 'build ok\n' })])
    expect(html).toContain('data-schedule-run="success"')
    expect(html).toContain('성공')
    expect(html).toContain('예약')
    expect(html).toContain('종료 코드 0')
    expect(html).toContain('1월 5일 09:00')
    expect(html).toMatch(/<pre[^>]*>build ok\n<\/pre>/)
    expect(html).not.toContain('대화 열기')
    expect(html).not.toContain('마지막 부분만')
  })

  it('잘린 출력은 그 사실을 알린다', () => {
    expect(render([run({ output: 'tail', outputTruncated: true })])).toContain(
      '출력이 길어 마지막 부분만 표시합니다.'
    )
  })

  it('프롬프트 실행은 대화 열기를 보이고 출력 영역이 없다', () => {
    const html = render([run({ origin: 'manual', sessionId: 'session-3' })])
    expect(html).toContain('대화 열기')
    expect(html).toContain('수동')
    expect(html).not.toContain('<pre')
    expect(html).not.toContain('종료 코드')
  })

  it('알려진 실패 사유는 문구로, 그 밖은 원문으로 보인다', () => {
    const html = render([
      run({ id: 1, status: 'error', error: SCHEDULE_RUN_ERROR.timeout, exitCode: null }),
      run({ id: 2, status: 'error', error: 'spawn ENOENT' }),
      run({ id: 3, status: 'skipped', error: SCHEDULE_RUN_ERROR.previousRunning })
    ])
    expect(html).toContain('실패')
    expect(html).toContain('제한 시간 초과')
    expect(html).not.toContain('>timeout<')
    expect(html).toContain('spawn ENOENT')
    expect(html).toContain('건너뜀')
    expect(html).toContain('이전 실행이 아직 진행 중')
    expect(html.match(/data-schedule-run="/g)).toHaveLength(3)
  })

  it('준 순서대로 그린다', () => {
    const html = render([run({ id: 2, output: 'SECOND' }), run({ id: 1, output: 'FIRST' })])
    expect(html.indexOf('SECOND')).toBeLessThan(html.indexOf('FIRST'))
  })

  it('사유 코드 전부에 문구가 있다', () => {
    for (const code of Object.values(SCHEDULE_RUN_ERROR)) {
      expect(runErrorKey(code)).toBe(`schedules.history.errors.${code}`)
      expect(ko.schedules.history.errors[code]).toBeTruthy()
    }
    expect(runErrorKey('spawn ENOENT')).toBeNull()
  })
})
