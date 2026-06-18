import { describe, it, expect } from 'vitest'
import { assemblePolicies, loadPolicies } from './loader'

// 구 PY_AGENT_RULES(runtime/env.ts) 의 `.trim()` 결과. 이주 후에도 바이트 동일해야 한다.
const PYTHON_RUNTIME_EXPECTED = `## Python 실행 규약
- Python 코드 실행: \`uv run python <스크립트>\` 또는 \`uv run python -c "..."\` 형태를 사용한다.
- 패키지 설치: \`uv pip install <패키지>\` 를 사용한다.
- 시스템 \`python\` / \`pip\` 직접 호출 금지 — 앱이 주입한 격리 환경에서만 동작한다.`

describe('loadPolicies — 실 번들', () => {
  it('python-runtime 본문이 구 PY_AGENT_RULES 와 바이트 동일하다(트림됨)', () => {
    const loaded = loadPolicies()
    expect(loaded.get('python-runtime')).toBe(PYTHON_RUNTIME_EXPECTED)
  })
})

describe('assemblePolicies — 정합 검증/트림', () => {
  const reg = [{ id: 'x', file: 'x.md' }]

  it('본문을 trim 해 적재한다', () => {
    const out = assemblePolicies(reg, { x: '\n  hello  \n' })
    expect(out.get('x')).toBe('hello')
  })

  it('registry 블록 본문이 sources 에 없으면 throw(누락)', () => {
    expect(() => assemblePolicies(reg, {})).toThrow(/정책 본문 누락/)
  })

  it('sources 에만 있고 registry 에 없으면 throw(잉여)', () => {
    expect(() => assemblePolicies(reg, { x: 'a', y: 'b' })).toThrow(/미등재 정책 본문/)
  })
})
