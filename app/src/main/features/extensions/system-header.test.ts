import { describe, it, expect } from 'vitest'
import { buildSystemHeader } from './system-header'

describe('buildSystemHeader', () => {
  it('전 필드 존재 시 Orca/User/Project 3섹션을 순서대로 조립한다', () => {
    const out = buildSystemHeader({
      orcaVersion: '1.0.0',
      language: '한국어',
      accountInstructions: '항상 존댓말을 쓴다',
      projectName: '센서 QA'
    })
    expect(out).toBe(
      [
        '# Orca',
        'You are running inside Orca — a Windows desktop app for engineers and AI beginners, not a terminal CLI. Responses render as rich markdown in a GUI transcript.',
        'Orca version: 1.0.0',
        '',
        '# User',
        'Preferred language: 한국어',
        'Account instructions: 항상 존댓말을 쓴다',
        '',
        '# Project',
        'Active project: 센서 QA'
      ].join('\n')
    )
  })

  it('Orca 섹션은 다른 필드가 전무해도 항상 포함된다', () => {
    const out = buildSystemHeader({ orcaVersion: '2.3.1' })
    expect(out).toBe(
      '# Orca\n' +
        'You are running inside Orca — a Windows desktop app for engineers and AI beginners, not a terminal CLI. Responses render as rich markdown in a GUI transcript.\n' +
        'Orca version: 2.3.1'
    )
    expect(out).not.toContain('# User')
    expect(out).not.toContain('# Project')
  })

  it('language 만 있으면 User 섹션에 Preferred language 만 넣는다', () => {
    const out = buildSystemHeader({ orcaVersion: '1.0.0', language: '한국어' })
    expect(out).toContain('# User\nPreferred language: 한국어')
    expect(out).not.toContain('Account instructions')
  })

  it('공백뿐인 accountInstructions/projectName 은 줄·섹션을 생략한다', () => {
    const out = buildSystemHeader({
      orcaVersion: '1.0.0',
      language: '한국어',
      accountInstructions: '   ',
      projectName: '  '
    })
    expect(out).not.toContain('Account instructions')
    expect(out).not.toContain('# Project')
    expect(out).toContain('Preferred language: 한국어')
  })

  it('accountInstructions/projectName 은 trim 되어 주입된다', () => {
    const out = buildSystemHeader({
      orcaVersion: '1.0.0',
      accountInstructions: '  간결하게  ',
      projectName: '  Alpha  '
    })
    expect(out).toContain('Account instructions: 간결하게')
    expect(out).toContain('Active project: Alpha')
  })
})
