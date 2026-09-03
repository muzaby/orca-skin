# OpenCode 공식 문서 원문 미러

이 디렉터리는 공식 저장소의 `v1.18.27` 문서를 수정 없이 보관한다. 가져온 날짜는 **2026-09-03 (KST)**이며, 설치 SDK도 **`@opencode-ai/sdk@1.18.27`**이다.
MDX는 웹사이트의 import·절대 URL·예제를 그대로 포함한다. 독립 렌더링용으로 고치지 않는다.

| 파일 | 고정 원문 | 용도 |
|---|---|---|
| [sdk.mdx](sdk.mdx) | [v1.18.27 SDK 문서](https://raw.githubusercontent.com/anomalyco/opencode/v1.18.27/packages/web/src/content/docs/sdk.mdx) | 공식 SDK 사용법 원문 |
| [server.mdx](server.mdx) | [v1.18.27 server 문서](https://raw.githubusercontent.com/anomalyco/opencode/v1.18.27/packages/web/src/content/docs/server.mdx) | 공식 HTTP 서버 문서 원문 |
| [LICENSE](LICENSE) | [v1.18.27 MIT License](https://raw.githubusercontent.com/anomalyco/opencode/v1.18.27/LICENSE) | 원저작권·복제 허가 고지 |

원문과 설치 패키지가 다르면 버전·import 표면을 먼저 구분한다. 원문의 잘못된 예제를 미러에서 수정하지 말고 [SDK 해설](../../opencode-sdk-spec.md)에 차이와 배포 타입 근거를 기록한다.
Orca 적용 방안은 [마이그레이션 연구](../../etc/study/opencode/orca-migration-guide.md)이며 채택된 제품 계약이 아니다.

## 원문 무결성

아래 SHA-256은 HTTP 원문 bytes 기준이며 저장 직후 로컬 파일과 일치했다 (UTF-8, LF).

| 파일 | SHA-256 |
|---|---|
| sdk.mdx | `147d4b88ce0dbcbfdb64df429f89280742ef95c34fef535ffbae95b840a6e93c` |
| server.mdx | `56aac4ea75990012a9ebf838d074760aa91e198f3b5859b38d6786b5e2d14c39` |
| LICENSE | `625f0f619133f89bbbb2abe37369613dfa1885eba1e50d02170deb62bb42cb6b` |

재동기화 시 버전 고정 URL에서 파일 전체를 교체하고 이 표·SDK 해설·상위 벤더 매니페스트를 함께 갱신한다. 자동 업데이트하지 않는다.
