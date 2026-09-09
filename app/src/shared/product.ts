// 제품 이름의 단일 소유자 (handoff 0225). 표시명·슬러그·레거시 슬러그가 여기서만 산다.
//
//   표시명 : 사람이 화면에서 읽는 이름. 공백을 포함한다.
//   슬러그 : 파일·디렉토리·store 이름이 쓰는 이름. 경로 세그먼트로 안전하다.
//
// **빌드 설정(`package.json`·`electron-builder.yml`)은 이 파일을 import 할 수 없다** — 값을
// 복제하되 `product-identity.test.ts` 가 두 사본을 파싱해 여기와 대조한다(§10 EP-01·EP-02).
//
// `package.json` 에 `productName` 키를 두지 않는다: `app.getName()` 이 `productName ?? name`
// 이라 키가 생기는 순간 userData 가 공백 포함 경로로 조용히 옮겨간다(0225 D-016).
export const PRODUCT_DISPLAY_NAME = 'Orcinus orca'

// 파일시스템·store 이름의 어근. `package.json` name 과 문자열이 같아야 한다(EP-01).
export const PRODUCT_SLUG = 'orcinus-orca'

// 0225 이전 설치본이 쓰던 어근. **이관 모듈에서만** 쓴다 — 정상 읽기 경로가 이 값을 참조하면
// D-010("전환 후 옛 경로를 자동 fallback 으로 쓰지 않는다")이 깨진다(§10 EP-05).
export const LEGACY_PRODUCT_SLUG = 'orca'

// Windows AppUserModelID = 바로가기 AUMID · NSIS 제거 레지스트리 키 GUID 의 입력.
// `electron-builder.yml` 의 `appId` 와 같아야 한다(EP-01).
export const APP_USER_MODEL_ID = 'com.orcinus-orca.app'
