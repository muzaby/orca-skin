// Connector 템플릿 레지스트리 (0161) — 빌드 타임 등록.
//
// 계약 타입은 `contracts/connector-template.ts` 가 소유한다(구현과 레지스트리가 서로 다른
// feature 슬라이스라 공유 타입을 contracts 로 올렸다 — `src/main/AGENTS.md` §해소책 1).

import type { ConnectorTemplate, ConnectorTemplateInfo } from '../../contracts/connector-template'

export type {
  ConnectorInstanceConfig,
  ConnectorTemplate,
  ConnectorTemplateField,
  ConnectorTemplateInfo,
  TemplatePackage
} from '../../contracts/connector-template'

export function describeTemplate(template: ConnectorTemplate): ConnectorTemplateInfo {
  return {
    templateId: template.id,
    i18nKey: template.i18nKey,
    fields: template.fields.map((field) => ({ ...field }))
  }
}

// 배열 한 줄로 템플릿이 늘어난다 — 코어 분기를 만들지 않는다.
export class ConnectorTemplateRegistry {
  private readonly templates = new Map<string, ConnectorTemplate>()

  constructor(templates: readonly ConnectorTemplate[] = []) {
    for (const template of templates) this.templates.set(template.id, template)
  }

  get(templateId: string): ConnectorTemplate | undefined {
    return this.templates.get(templateId)
  }

  list(): ConnectorTemplate[] {
    return [...this.templates.values()]
  }

  describe(): ConnectorTemplateInfo[] {
    return this.list().map(describeTemplate)
  }
}
