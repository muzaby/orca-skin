// `SecretStore` 의 **구조적 포트**.
//
// 별도 파일인 이유는 하나다: `secret-store.ts` 는 `electron-store`·`safeStorage` 를 물어서
// 그 파일을 import 하는 순간 테스트가 electron 바이너리를 요구한다(P29). 타입만 여기 두면
// vault·provider 인증 테스트가 electron 없이 돈다.
//
// 0183 까지 이 파일에는 네임스페이스 facade(`createNamespacedSecretFacade`·
// `providerSecretPrefix`)가 함께 있었다. 그 네임스페이스에 쓰는 쪽은 0157 에 사라졌고
// 0183 이 마지막 독자(정적 usage provider)까지 지웠다 — 남은 것은 포트뿐이다.
export interface SecretStorePort {
  get(name: string): string | undefined
  set(name: string, plain: string): void
  delete(name: string): void
}
