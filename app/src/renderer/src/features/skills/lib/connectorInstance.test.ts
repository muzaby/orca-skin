import { describe, expect, it } from 'vitest'
import {
  classifyCreateFailure,
  describeApiBase,
  draftForTemplate,
  EMPTY_DRAFT,
  splitServerUrl,
  toCreateRequest,
  validateDraft,
  type InstanceDraft
} from './connectorInstance'

function draft(overrides: Partial<InstanceDraft> = {}): InstanceDraft {
  return {
    templateId: 'confluence',
    label: '위키',
    address: 'https://wiki.corp',
    ...overrides
  }
}

describe('draftForTemplate', () => {
  it('draftForTemplate 은 받은 템플릿으로 초안을 연다', () => {
    // 선택은 추가 메뉴가 끝냈다(0162) — 모달은 그 결과를 받아 주소만 묻는다.
    expect(draftForTemplate('confluence')).toEqual({ ...EMPTY_DRAFT, templateId: 'confluence' })
  })

  it('템플릿 외 필드는 비어 있다', () => {
    const opened = draftForTemplate('confluence')
    expect(opened.label).toBe('')
    expect(opened.address).toBe('')
  })
})

describe('splitServerUrl', () => {
  it('주소를 origin 과 컨텍스트 경로로 쪼갠다', () => {
    expect(splitServerUrl('https://wiki.corp/confluence')).toEqual({
      baseUrl: 'https://wiki.corp',
      apiBasePath: '/confluence'
    })
  })

  it('경로가 없으면 컨텍스트 경로 키를 만들지 않는다', () => {
    expect(splitServerUrl('https://wiki.corp')).toEqual({ baseUrl: 'https://wiki.corp' })
    expect(splitServerUrl('https://wiki.corp/')).toEqual({ baseUrl: 'https://wiki.corp' })
  })

  it('뷰 경로 앞까지만 컨텍스트 경로다', () => {
    // 사용자는 보통 보고 있던 문서의 URL 을 그대로 붙여넣는다.
    expect(splitServerUrl('https://wiki.corp/confluence/display/SP/Page')).toEqual({
      baseUrl: 'https://wiki.corp',
      apiBasePath: '/confluence'
    })
  })

  it('첫 세그먼트가 뷰 경로면 컨텍스트 경로가 없다', () => {
    expect(splitServerUrl('https://wiki.corp/display/SP/Page')).toEqual({
      baseUrl: 'https://wiki.corp'
    })
  })

  it('포트를 유지한다', () => {
    expect(splitServerUrl('https://wiki.corp:8443/confluence')).toEqual({
      baseUrl: 'https://wiki.corp:8443',
      apiBasePath: '/confluence'
    })
  })

  it('중첩 컨텍스트 경로도 통째로 가져간다', () => {
    expect(splitServerUrl('https://corp.com/tools/wiki-dc/display/A')).toEqual({
      baseUrl: 'https://corp.com',
      apiBasePath: '/tools/wiki-dc'
    })
  })

  it('해석 불가·비 http 스킴·주소에 섞인 자격증명은 null 이다', () => {
    expect(splitServerUrl('')).toBeNull()
    expect(splitServerUrl('wiki.corp')).toBeNull()
    expect(splitServerUrl('ftp://wiki.corp')).toBeNull()
    expect(splitServerUrl('https://user:pw@wiki.corp')).toBeNull()
  })
})

describe('주소 입력', () => {
  // 0162 회귀: 매 키 입력마다 origin 으로 되쓰는 로직이 `/` 를 먹어
  // `https://wiki.corp/confluence` 가 `https://wiki.corpconfluence` 가 됐다.
  it('주소 입력은 타이핑 중 값을 고치지 않는다', () => {
    const typed = 'https://wiki.corp/confluence'
    let state = draftForTemplate('confluence')
    for (const char of typed) {
      // 모달의 onChange 와 같은 규칙 — 받은 값을 그대로 담는다.
      state = { ...state, address: state.address + char }
    }
    expect(state.address).toBe(typed)
    expect(splitServerUrl(state.address)).toEqual({
      baseUrl: 'https://wiki.corp',
      apiBasePath: '/confluence'
    })
  })
})

describe('describeApiBase', () => {
  it('적용될 주소를 사람이 읽을 문자열로 만든다', () => {
    expect(describeApiBase({ baseUrl: 'https://wiki.corp', apiBasePath: '/confluence' })).toBe(
      'https://wiki.corp/confluence'
    )
    expect(describeApiBase({ baseUrl: 'https://wiki.corp' })).toBe('https://wiki.corp')
  })
})

describe('validateDraft', () => {
  it('정상 입력을 통과시킨다', () => {
    expect(validateDraft(draft())).toBeNull()
    expect(validateDraft(draft({ address: 'https://wiki.corp/confluence' }))).toBeNull()
  })

  it('템플릿 미선택을 잡는다', () => {
    expect(validateDraft(draft({ templateId: null }))).toBe('template_required')
  })

  it('빈 라벨을 잡는다', () => {
    expect(validateDraft(draft({ label: '   ' }))).toBe('label_required')
  })

  it('해석되지 않는 주소를 사유로 낸다', () => {
    expect(validateDraft(draft({ address: '' }))).toBe('address_invalid')
    expect(validateDraft(draft({ address: 'wiki.corp' }))).toBe('address_invalid')
  })
})

describe('toCreateRequest', () => {
  it('공백을 정리해 전송 형상을 만든다', () => {
    expect(toCreateRequest(draft({ label: '  위키  ', address: '  https://wiki.corp  ' }))).toEqual(
      {
        templateId: 'confluence',
        label: '위키',
        baseUrl: 'https://wiki.corp'
      }
    )
  })

  it('컨텍스트 경로가 있으면 키를 실어 보낸다', () => {
    expect(toCreateRequest(draft({ address: 'https://wiki.corp/confluence' }))).toEqual({
      templateId: 'confluence',
      label: '위키',
      baseUrl: 'https://wiki.corp',
      apiBasePath: '/confluence'
    })
  })

  it('빈 컨텍스트 경로는 키 자체를 보내지 않는다', () => {
    expect(toCreateRequest(draft())).not.toHaveProperty('apiBasePath')
  })

  it('해석 불가 주소는 전송 형상을 만들지 않는다', () => {
    expect(toCreateRequest(draft({ address: 'wiki.corp' }))).toBeNull()
  })
})

describe('classifyCreateFailure', () => {
  it('중복 생성 실패를 사유로 분류한다', () => {
    expect(classifyCreateFailure(new Error('already_exists: confluence-wiki-corp'))).toBe(
      'already_exists'
    )
  })

  it('나머지 사유도 갈라낸다', () => {
    expect(classifyCreateFailure(new Error('unknown_template: jira'))).toBe('unknown_template')
    expect(classifyCreateFailure(new Error('register_failed: ...'))).toBe('register_failed')
    expect(classifyCreateFailure(new Error('invalid_input: ...'))).toBe('invalid_input')
    expect(classifyCreateFailure('뭔가 다른 것')).toBe('unknown')
  })
})
