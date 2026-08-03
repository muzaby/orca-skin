import { describe, expect, it } from 'vitest'
import {
  classifyCreateFailure,
  EMPTY_DRAFT,
  initialDraft,
  initialStep,
  splitPastedUrl,
  toCreateRequest,
  validateDraft,
  type InstanceDraft
} from './connectorInstance'
import type { ConnectorTemplateInfoDto } from '../../../../../shared/ipc'

const CONFLUENCE: ConnectorTemplateInfoDto = {
  templateId: 'confluence',
  i18nKey: 'skills.templates.confluence',
  fields: [
    { name: 'label', required: true, i18nKey: 'skills.instance.label' },
    { name: 'baseUrl', required: true, i18nKey: 'skills.instance.baseUrl' },
    { name: 'apiBasePath', required: false, i18nKey: 'skills.instance.apiBasePath' }
  ]
}

const JIRA: ConnectorTemplateInfoDto = { ...CONFLUENCE, templateId: 'jira' }

function draft(overrides: Partial<InstanceDraft> = {}): InstanceDraft {
  return {
    templateId: 'confluence',
    label: '위키',
    baseUrl: 'https://wiki.corp',
    apiBasePath: '',
    ...overrides
  }
}

describe('단계 전이', () => {
  it('템플릿이 하나뿐이면 선택 단계를 건너뛴다', () => {
    // 선택지가 없는 선택 화면은 클릭만 늘린다.
    expect(initialStep([CONFLUENCE])).toBe('server')
    expect(initialDraft([CONFLUENCE]).templateId).toBe('confluence')
  })

  it('템플릿이 여럿이면 선택부터 한다', () => {
    expect(initialStep([CONFLUENCE, JIRA])).toBe('template')
    expect(initialDraft([CONFLUENCE, JIRA])).toEqual(EMPTY_DRAFT)
  })

  it('템플릿이 없으면 선택 단계로 두고 사유를 보여준다', () => {
    expect(initialStep([])).toBe('template')
    expect(initialDraft([]).templateId).toBeNull()
  })
})

describe('validateDraft', () => {
  it('정상 입력을 통과시킨다', () => {
    expect(validateDraft(draft())).toBeNull()
    expect(validateDraft(draft({ apiBasePath: '/confluence' }))).toBeNull()
    expect(validateDraft(draft({ apiBasePath: 'confluence/' }))).toBeNull()
  })

  it('템플릿 미선택을 잡는다', () => {
    expect(validateDraft(draft({ templateId: null }))).toBe('template_required')
  })

  it('빈 라벨을 잡는다', () => {
    expect(validateDraft(draft({ label: '   ' }))).toBe('label_required')
  })

  it('잘못된 주소를 사유로 낸다', () => {
    const bad = [
      'wiki.corp',
      'https://wiki.corp/confluence',
      'https://wiki.corp?a=1',
      'https://user:pw@wiki.corp',
      'file:///etc/passwd',
      ''
    ]
    for (const baseUrl of bad) {
      expect(validateDraft(draft({ baseUrl })), baseUrl).toBe('base_url_invalid')
    }
  })

  it('잘못된 컨텍스트 경로를 잡는다', () => {
    expect(validateDraft(draft({ apiBasePath: '/a b' }))).toBe('api_base_path_invalid')
    expect(validateDraft(draft({ apiBasePath: '/?x' }))).toBe('api_base_path_invalid')
  })
})

describe('toCreateRequest', () => {
  it('공백을 정리해 전송 형상을 만든다', () => {
    expect(toCreateRequest(draft({ label: '  위키  ', baseUrl: ' https://wiki.corp ' }))).toEqual({
      templateId: 'confluence',
      label: '위키',
      baseUrl: 'https://wiki.corp'
    })
  })

  it('빈 컨텍스트 경로는 키 자체를 보내지 않는다', () => {
    // 스키마가 빈 문자열을 거부하므로 키를 넣으면 요청이 통째로 튕긴다.
    const request = toCreateRequest(draft({ apiBasePath: '   ' }))
    expect('apiBasePath' in request).toBe(false)
  })

  it('컨텍스트 경로를 정규화해 보낸다', () => {
    expect(toCreateRequest(draft({ apiBasePath: 'confluence/' })).apiBasePath).toBe('/confluence')
  })
})

describe('splitPastedUrl', () => {
  it('붙여넣은 URL 에서 origin 과 경로를 분리한다', () => {
    // 사용자는 브라우저 주소창을 그대로 붙여넣는다.
    expect(splitPastedUrl('https://wiki.corp/confluence/display/ENG/Page')).toEqual({
      origin: 'https://wiki.corp',
      suggestedBasePath: '/confluence'
    })
  })

  it('잘 알려진 뷰 경로는 컨텍스트 경로로 제안하지 않는다', () => {
    // `/display` 를 컨텍스트 경로로 오인하면 모든 요청이 404 가 된다.
    for (const url of [
      'https://wiki.corp/display/ENG/Page',
      'https://wiki.corp/pages/viewpage.action?pageId=1',
      'https://wiki.corp/spaces/ENG'
    ]) {
      expect(splitPastedUrl(url)?.suggestedBasePath, url).toBe('')
    }
  })

  it('origin 만 붙여넣어도 동작한다', () => {
    expect(splitPastedUrl('https://wiki.corp')).toEqual({
      origin: 'https://wiki.corp',
      suggestedBasePath: ''
    })
  })

  it('해석 불가 입력은 null 이다', () => {
    for (const raw of ['', '   ', 'wiki.corp', 'file:///x']) {
      expect(splitPastedUrl(raw), raw).toBeNull()
    }
  })
})

describe('classifyCreateFailure', () => {
  it('중복 생성 실패를 사유로 분류한다', () => {
    expect(classifyCreateFailure(new Error('already_exists: confluence-wiki-corp'))).toBe(
      'already_exists'
    )
  })

  it('나머지 사유도 갈라낸다', () => {
    expect(classifyCreateFailure(new Error('invalid_input: baseUrl'))).toBe('invalid_input')
    expect(classifyCreateFailure(new Error('invalid_id: x'))).toBe('invalid_input')
    expect(classifyCreateFailure(new Error('unknown_template: jira'))).toBe('unknown_template')
    expect(classifyCreateFailure(new Error('register_failed: dup'))).toBe('register_failed')
    expect(classifyCreateFailure(new Error('뭔가 다른 오류'))).toBe('unknown')
    expect(classifyCreateFailure(undefined)).toBe('unknown')
  })
})
