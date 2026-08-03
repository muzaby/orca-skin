// 추가 메뉴의 **행 구성** (0162) — React 비의존.
//
// 사용자 요구: "플러그인 추가 버튼 클릭시 커넥터 항목들을 나열해야 한다 / 현재는 컨플루언스만".
// 나열 대상은 main 의 템플릿 레지스트리가 준다(`plugins.templateList`, 0161).

import type { ConnectorTemplateInfoDto } from '../../../../../shared/ipc'

export interface AddMenuRow {
  templateId: string
  label: string
}

// `loading` 과 `empty` 를 가른다 — 아직 안 온 것과 없는 것은 다르다. 로딩 중에 "추가할 수 있는
// 서비스가 없습니다" 를 띄우면 오보다.
export type AddMenuState =
  { kind: 'loading' } | { kind: 'empty' } | { kind: 'rows'; rows: readonly AddMenuRow[] }

// 템플릿 라벨은 main 이 **i18n 키**로 선언하고 renderer 카탈로그가 문구를 갖는다(UI 문구는
// renderer 소유라는 저장소 규약). 키가 카탈로그에 없으면 i18next 는 키 자체를 돌려주므로,
// 그때는 templateId 로 낮춰 사용자가 최소한 무엇인지 알 수 있게 한다.
export function resolveTemplateLabel(
  template: ConnectorTemplateInfoDto,
  translate: (key: string) => string
): string {
  const resolved = translate(template.i18nKey)
  return resolved === template.i18nKey ? template.templateId : resolved
}

export function addMenuState(
  // null = 아직 응답이 오지 않았다.
  templates: readonly ConnectorTemplateInfoDto[] | null,
  translate: (key: string) => string
): AddMenuState {
  if (templates === null) return { kind: 'loading' }
  if (templates.length === 0) return { kind: 'empty' }
  return {
    kind: 'rows',
    rows: templates.map((template) => ({
      templateId: template.templateId,
      label: resolveTemplateLabel(template, translate)
    }))
  }
}
