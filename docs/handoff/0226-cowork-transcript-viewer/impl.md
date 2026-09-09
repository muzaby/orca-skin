# 구현 보고 — Work transcript와 출력 뷰어

구현 완료: Work의 도구 활동을 Cowork 참고 자료처럼 요약·타임라인·요청/응답으로 표시하고, 현재 게시 출력에서 우측 파일 뷰어를 연다. 사용자 원본 JSONL의 지시는 실행하지 않았으며 일반 생성물 자동 수집은 추가하지 않았다.

## 반영 결과

| 영역 | 동작 |
|---|---|
| Work transcript | 무테 요약, 반복 호출을 포함한 호출 수, 아이콘·세로선, 개별 펼침, 전체 높이가 제한된 요청/응답/오류 상세 |
| 도구 의미 | TaskXXX 구조화 결과·실패와 원문 보존, 실제 검색 결과의 제목·도메인·개수, 빈 요청 생략 |
| 뷰어 | 출력 행·transcript 카드의 두 진입, Markdown/HTML 미리보기, 줄번호 코드, 이미지, 복사·다운로드·확대·닫기·오류 재시도 |
| 수명 | 숨긴 기존 패널 mounted·inert 유지, 닫을 때 초점·스크롤 복원, 세션/파일 전환·재시도·unmount 시 지각 응답 폐기 |
| 파일 경계 | ID 기반 소유권 재검사, 제한 읽기·UTF-8·이미지 서명, 추가 migration으로 기존 게시·포크·참조 보존 |
| HTML | Main의 기존 cheerio로 전체 문서를 정제해 별도 previewContent 전달. 원문·다운로드는 보존하며 iframe은 스크립트·탐색·네트워크 권한 없이 표시 |

## 검증

| 검사 | 관측 |
|---|---|
| 채팅·Markdown 회귀 | Vitest 163파일, 1,255테스트 PASS |
| 파일·IPC·preload·DB | Electron-as-Node Vitest 12파일, 110테스트 PASS. SQLite ABI 재빌드 없음 |
| 운영 스크립트 | Node test 116테스트 PASS |
| 타입 | node/web/test 전체 PASS |
| lint | 전체 오류 0. 기존 useTranscriptVirtualizer의 React Compiler 경고 1개; 변경 파일의 포맷 경고는 정리 후 범위 재검사 PASS |
| 빌드 | Electron main/preload/renderer production build PASS |
| 문서·migration | inventory 생성/링크 검사, migration 동기화·사본·append-only, diff 공백 검사 PASS |
| 최종 국소 수정 | HTML 기본 캔버스 보존 7테스트, CodeBlock 원문 줄번호 2테스트와 범위 ESLint PASS |
| Native | 46개 단언 PASS, 런타임 오류 0, 외부 HTTP(S) 요청 0. 최종 소스 hash 불일치 0 |

Native 관측과 소스 SHA-256은 [native-validation.json](evidence/native-validation.json)에 기록했다. 실제 React 컴포넌트·store·Main 포맷 변환기와 production CSS/CSP를 사용하며, SDK·사용자 DB 대신 합성 IPC를 연결한다. 따라서 이 증거는 설치 앱의 라이브 SDK 대화 실행을 주장하지 않는다.

시각 확인: [Work 상세](evidence/transcript.png), [줄번호 소스](evidence/source.png), [HTML](evidence/html.png), [이미지](evidence/image.png), [어두운 테마](evidence/dark.png). HTML의 body 배경이 아래 canvas까지 이어지고 소스에 줄번호가 표시되는 것을 확인했다.

재현 명령(저장소 루트, Windows PowerShell):

```powershell
Set-Location app
npm run typecheck
node node_modules/eslint/bin/eslint.js ./src ./scripts
node node_modules/vitest/vitest.mjs run src/renderer/src/features/chat src/renderer/src/shared/ui/markdown --maxWorkers=2
node --test scripts/*.test.mjs
node scripts/check-doc-inventory.mjs --check
node scripts/check-migrations-appendonly.mjs
node node_modules/electron-vite/bin/electron-vite.js build
Set-Location ..
node docs/handoff/0226-cowork-transcript-viewer/fixtures/native-build.mjs
```

마지막 명령이 출력한 cache 경로를 runner에 전달한다. Native runner는 숨긴 새 창과 임시 profile을 사용하고 외부 HTTP(S) 요청을 차단·계수한다.

```powershell
$env:ELECTRON_RUN_AS_NODE = $null
$native = Start-Process -FilePath './app/node_modules/electron/dist/electron.exe' -ArgumentList @('docs/handoff/0226-cowork-transcript-viewer/fixtures/native-runner.cjs', '<출력된 cache 경로>') -WindowStyle Hidden -PassThru -Wait
$native.ExitCode
```

DB 검증은 `app`에서 아래 명령을 실행한다. 이 모드는 기존 Electron용 SQLite 바이너리를 그대로 사용한다.

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& ./node_modules/electron/dist/electron.exe node_modules/vitest/vitest.mjs run src/main/features/artifacts src/main/infra/db/artifact-formats-migration.test.ts src/main/infra/db/artifact-queries.test.ts src/main/infra/db/migrate.test.ts src/main/app/handlers/artifacts.test.ts src/preload/index.test.ts src/shared/artifacts.test.ts --pool=threads --maxWorkers=1 | Out-String
$env:ELECTRON_RUN_AS_NODE = $null
```

## 구현 중 발견과 수정

| 발견 | 수정·근거 |
|---|---|
| Wasm 구문 강조가 production CSP에서 차단됨 | 기존 Shiki의 JavaScript 정규식 엔진 사용. CSP 완화 없이 native에서 지원 언어 강조 관측 |
| 줄번호 pseudo content가 후속 Tailwind before utility에 덮임 | content utility로 counter 변수를 설정. native의 실제 computed pseudo content와 화면 확인 |
| Work 전용 본문이 TaskXXX 구조화 결과를 건너뜀 | 기존 관측 함수·TaskToolBody 재사용. 실패 이유가 닫힌 원문 밖에 노출되는 RED→GREEN |
| 브라우저 fragment 파싱이 HTML/body 속성을 제거함 | Main의 전체 문서 파서로 이동. 원문·루트 스타일·언어 보존 및 active markup 제거 검증 |
| 기본 HTML root 배경이 body 배경의 canvas 전파를 막음 | 기본 밝은 canvas는 iframe에 두고 문서 root는 투명하게 유지 |
| 이전 세션의 카드 callback이 현재 세션에 진입할 수 있음 | 렌더 시 세션 키를 고정하고 현재 키와 대조. stale callback RED→GREEN |

외부 코드 리뷰는 구현자의 수정 확인에 사용했다. 정식 handoff 독립 검증은 `Verified-By: pending`이며 기존 0223·0224 작업의 판정은 변경하지 않는다.
