# ΔV6 재현 자료 (2026-11-27 · 기준 `c052c301`)

설계 턴에서 원인을 확정할 때 쓴 일회성 재현 도구와 결과다. CI 단계가 아니며 제품 코드가 아니다. 판정 정본은 [plan §23](../../plan.md).

| 파일 | 무엇을 재현하는가 | 결과 |
|---|---|---|
| `probe.tsx` · `run-probe.mjs` | 실제 `TranscriptView`·store·워커를 Playwright Chromium에 띄워 행 구조·구문 강조·Markdown을 센다 | `probe-results.json` |
| `run-drop.mjs` | 본문 조립 도중 실행 중인 diff(pair) 작업을 취소해 계산 워커를 교체한다 | 취소 없음: 다음 조각 정상 · 취소: `Invalid history body range` |
| `stale-body.db.test.ts.txt` | 이미 색인된 메시지 변경 → 새 세대 발행 → 이전 본문 참조 `stale` | 파일 머리 주석 |
| `run-notes.mjs` · `work-notes-before-after.json` | 펼친 Work 목록의 메모 행(ΔV7) | 수정 전 8행(보이지 않는 메모 4) → 수정 후 4행 |
| `dev-worker.mjs` | electron-vite renderer 설정의 Vite dev 서버에서 계산·Markdown 워커를 띄운다(ΔV8) | 수정 전 둘 다 `ReferenceError: document is not defined` · 수정 후 둘 다 생존 |
| `resolver-probe.mjs` | 같은 설정의 Vite 해석기로 `decode-named-character-reference`를 serve·build × 소스·사전 번들로 푼다(ΔV8) | 수정 전 4경로 `index.dom.js` · 수정 후 4경로 `index.js` |

실행: `dev-worker.mjs`·`resolver-probe.mjs`는 `node <경로>`(`dev-worker.mjs`는 `src/renderer/zz-dev-worker.html`을 잠시 만든다 — 끝나면 지운다). `probe.tsx`를 `app/scripts/zz-scratch-probe/probe.tsx`로 복사한 뒤 `app/`에서 `node <경로>/run-probe.mjs claude-work:normal claude-code:pendingAsk …`(인자 = `화면:시나리오[:deferred]`). Playwright는 사전 설치본을 쓴다. 끝나면 복사한 디렉토리를 지운다.
