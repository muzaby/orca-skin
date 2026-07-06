import { describe, it, expect } from 'vitest'
import { buildSystemHeader } from './system-header'

describe('buildSystemHeader', () => {
  it('전 필드 존재 시 Orca/User/Project 3섹션을 순서대로 조립하고 지침을 # Project 안에 넣는다', () => {
    const out = buildSystemHeader({
      orcaVersion: '1.0.0',
      language: '한국어',
      accountInstructions: '항상 존댓말을 쓴다',
      projectName: '센서 QA',
      projectInstructions: '항상 근거를 붙여라'
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
        'Active project: 센서 QA',
        'Project instructions:',
        '항상 근거를 붙여라'
      ].join('\n')
    )
  })

  it('projectName 만 있으면 Active project 만(Project instructions 라벨 없음)', () => {
    const out = buildSystemHeader({ orcaVersion: '1.0.0', projectName: 'Alpha' })
    expect(out).toContain('# Project\nActive project: Alpha')
    expect(out).not.toContain('Project instructions')
  })

  it('projectName 없으면 지침이 있어도 # Project 섹션을 통째 생략한다', () => {
    const out = buildSystemHeader({
      orcaVersion: '1.0.0',
      projectInstructions: '무시되어야 함'
    })
    expect(out).not.toContain('# Project')
    expect(out).not.toContain('무시되어야 함')
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

  it('accountInstructions/projectName/projectInstructions 는 trim 되어 주입된다', () => {
    const out = buildSystemHeader({
      orcaVersion: '1.0.0',
      accountInstructions: '  간결하게  ',
      projectName: '  Alpha  ',
      projectInstructions: '  TDD 로 진행  '
    })
    expect(out).toContain('Account instructions: 간결하게')
    expect(out).toContain('Active project: Alpha')
    expect(out).toContain('Project instructions:\nTDD 로 진행')
  })

  it('projectName 있고 지침이 공백뿐이면 Project instructions 를 생략한다', () => {
    const out = buildSystemHeader({
      orcaVersion: '1.0.0',
      projectName: 'Alpha',
      projectInstructions: '   '
    })
    expect(out).toContain('Active project: Alpha')
    expect(out).not.toContain('Project instructions')
  })
})
