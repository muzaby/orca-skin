// Connector 템플릿 계약 (0161) — 사용자가 UI 에서 서버를 추가할 때 쓰는 청사진.
//
// **contracts 에 두는 이유**: 구현(`features/auth-platform/modules/<x>`)과 레지스트리
// (`features/connectors`)가 **서로 다른 feature 슬라이스**에 있어 직접 import 가 금지된다.
// 공유 타입을 contracts 로 올리는 것이 저장소의 1번 해소책이다(`src/main/AGENTS.md`).
//
// **코드는 여전히 빌드 타임에 있다.** 런타임에 오는 것은 *설정*(주소·라벨)뿐이고 임의 경로
// `import()` 는 없다 — `contracts/auth-plugin.ts` 헤더의 "런타임 동적 로딩 금지" 를 그대로 지킨다.
//
// ## 왜 패키지를 둘로 나누나
//
// registry 는 **중복 provider id 를 거부**한다(`auth-platform/registry.ts` — last-writer-wins 금지).
// 인스턴스마다 provider 를 함께 등록하면 두 번째 서버 추가가 통째로 실패한다. 그래서:
//
//   sharedPackage()   — auth provider. 템플릿당 **한 번만** 등록한다.
//   instancePackage() — connector + runtime tools. 인스턴스마다 등록/해제한다.
//
// 인스턴스 connector 가 다른 패키지(shared)의 provider 를 참조하는 것은 manifest 가 명시적으로
// 허용한다(`auth-platform/manifest.ts` "connector 가 같은 패키지 밖 provider 를 참조하는 것은
// 허용한다 — 재사용이 목적"). 그 허용이 없으면 이 분리가 성립하지 않는다.

export interface ConnectorTemplateField {
  name: 'label' | 'baseUrl' | 'apiBasePath'
  required: boolean
  // renderer 가 i18n 키로 라벨을 그린다 — main 에 UI 문구를 두지 않는다.
  i18nKey: string
  placeholder?: string
}

export interface ConnectorInstanceConfig {
  // `deriveConnectorId` 파생값 — 사용자 입력이 아니다.
  connectorId: string
  templateId: string
  label: string
  // 경로 없는 origin.
  baseUrl: string
  apiBasePath?: string
}

// 템플릿이 만드는 패키지의 형상. `features/auth-platform/modules/index.ts` 의
// `AuthPluginPackage` 와 구조적으로 같지만, 그 타입은 feature 안에 있어 여기서 참조할 수
// 없다 — 구조적으로 같은 형상을 계약으로 선언하고 컴포지션 루트가 이어붙인다.
export interface TemplatePackage {
  manifest: unknown
  providers?: readonly unknown[]
  connectors?: readonly unknown[]
  runtimeTools?: readonly unknown[]
}

export interface ConnectorTemplate {
  readonly id: string
  // renderer 표시용 i18n 키.
  readonly i18nKey: string
  readonly fields: readonly ConnectorTemplateField[]
  // 템플릿당 1회 등록되는 공용 기여(주로 auth provider).
  sharedPackage(): TemplatePackage
  // 인스턴스 하나가 등록할 패키지.
  instancePackage(config: ConnectorInstanceConfig): TemplatePackage
}

// renderer 로 나가는 DTO — 함수를 뺀 순수 데이터.
export interface ConnectorTemplateInfo {
  templateId: string
  i18nKey: string
  fields: ConnectorTemplateField[]
}
