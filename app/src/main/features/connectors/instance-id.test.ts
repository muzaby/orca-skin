import { describe, expect, it } from 'vitest'
import { deriveConnectorId, isValidConnectorId, kebabSegment } from './instance-id'
import { PLUGIN_ID_MAX_LENGTH, PLUGIN_ID_PATTERN } from '../../../shared/protocol'

describe('deriveConnectorId', () => {
  it('host 에서 케밥 ID 를 만든다', () => {
    expect(deriveConnectorId({ templateId: 'confluence', baseUrl: 'https://wiki.corp' })).toBe(
      'confluence-wiki-corp'
    )
  })

  it('포트·대문자·언더스코어를 정규화한다', () => {
    expect(
      deriveConnectorId({ templateId: 'confluence', baseUrl: 'https://Wiki_Corp.LOCAL:8443' })
    ).toBe('confluence-wiki-corp-local-8443')
  })

  it('컨텍스트 경로를 ID 에 포함한다', () => {
    // 같은 host 에 경로만 다른 두 서버를 구분할 수 있어야 한다 — host 파생의 첫 번째 구멍.
    const root = deriveConnectorId({ templateId: 'confluence', baseUrl: 'https://wiki.corp' })
    const scoped = deriveConnectorId({
      templateId: 'confluence',
      baseUrl: 'https://wiki.corp',
      apiBasePath: '/confluence'
    })
    expect(root).toBe('confluence-wiki-corp')
    expect(scoped).toBe('confluence-wiki-corp-confluence')
    expect(root).not.toBe(scoped)
  })

  it('경로 구분자와 빈 경로를 흡수한다', () => {
    const cases = ['/confluence', 'confluence', '/confluence/', '//confluence//']
    for (const apiBasePath of cases) {
      expect(
        deriveConnectorId({ templateId: 'confluence', baseUrl: 'https://w.corp', apiBasePath })
      ).toBe('confluence-w-corp-confluence')
    }
    for (const apiBasePath of ['', '/', undefined]) {
      expect(
        deriveConnectorId({ templateId: 'confluence', baseUrl: 'https://w.corp', apiBasePath })
      ).toBe('confluence-w-corp')
    }
  })

  it('중첩 경로도 조각으로 이어붙인다', () => {
    expect(
      deriveConnectorId({
        templateId: 'confluence',
        baseUrl: 'https://w.corp',
        apiBasePath: '/team/wiki'
      })
    ).toBe('confluence-w-corp-team-wiki')
  })

  it('파생 결과가 등록 가능한 패턴을 만족한다', () => {
    const ids = [
      deriveConnectorId({ templateId: 'confluence', baseUrl: 'https://wiki.corp' }),
      deriveConnectorId({ templateId: 'confluence', baseUrl: 'http://10.0.0.5:8090' }),
      deriveConnectorId({
        templateId: 'confluence',
        baseUrl: 'https://a-b.c.corp:443',
        apiBasePath: '/x_y'
      })
    ]
    for (const id of ids) {
      expect(PLUGIN_ID_PATTERN.test(id), id).toBe(true)
      expect(isValidConnectorId(id), id).toBe(true)
    }
  })

  it('상한을 넘는 이름을 잘라도 패턴을 깨지 않는다', () => {
    const long = `https://${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.corp`
    const id = deriveConnectorId({ templateId: 'confluence', baseUrl: long })
    expect(id.length).toBeLessThanOrEqual(PLUGIN_ID_MAX_LENGTH)
    // 자른 자리에 '-' 가 남으면 패턴 위반이 된다.
    expect(PLUGIN_ID_PATTERN.test(id)).toBe(true)
  })

  it('해석 불가 주소는 빈 host 로 접혀 등록 불가 ID 를 만든다', () => {
    // 조용히 `confluence` 라는 그럴듯한 ID 를 만들지 않고, 호출부가 검증에서 걸러낸다.
    const id = deriveConnectorId({ templateId: 'confluence', baseUrl: 'not a url' })
    expect(id).toBe('confluence')
    // 형태는 유효하지만 host 가 비었다는 사실은 baseUrl 스키마가 먼저 거부한다.
    expect(isValidConnectorId(id)).toBe(true)
  })
})

describe('kebabSegment', () => {
  it('비허용 문자를 하나의 하이픈으로 접는다', () => {
    expect(kebabSegment('A..B__C//D')).toBe('a-b-c-d')
    expect(kebabSegment('---x---')).toBe('x')
    expect(kebabSegment('!!!')).toBe('')
  })
})

describe('isValidConnectorId', () => {
  it('빈 문자열과 패턴 위반을 거부한다', () => {
    expect(isValidConnectorId('')).toBe(false)
    expect(isValidConnectorId('-x')).toBe(false)
    expect(isValidConnectorId('x-')).toBe(false)
    expect(isValidConnectorId('X')).toBe(false)
    expect(isValidConnectorId('a'.repeat(PLUGIN_ID_MAX_LENGTH + 1))).toBe(false)
  })

  it('정상 ID 를 통과시킨다', () => {
    expect(isValidConnectorId('confluence-wiki-corp')).toBe(true)
  })
})
