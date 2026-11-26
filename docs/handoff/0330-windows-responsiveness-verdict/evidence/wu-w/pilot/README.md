# W-048 파일럿 — W1 · `515ff58d` · Claude Code · history-1 · 반복 1

**판정: 파이프라인 통과.** CDP 기록 → 추출기(`windows-observe.mjs`) → 판독기(`windows-verdict.mjs`)가 끝까지 돌고, 판독기가 원본 해시·런타임(`profile.txt` Caption)·SHA·출처를 받아 표본을 셌다. 셀은 반복 1·짝 없음이라 `미판정(반복 부족)`·`기록 전용(짝 없음)`이다(정상).

| 항목 | 값 |
|---|---|
| 빌드 | 진단 v3 `515ff58d` · exe SHA-256 `8eee1b46…` · diff `b66ed092…`(`builds.json`) |
| 프로필 | 실제 프로필 사본(`real-copy`) + 측정 프로젝트 `measure-scratch`(빈 폴더) · `OO_MEASURE_USER_DATA` — 실제 `%APPDATA%\orcinus-orca` 불변(SHA-256 대조) |
| 입력 | **CDP 합성 입력**(`pilot-w1.mjs`) — P1 전송 → `keyDown(text)` 200회(IME 조합 아님) → 휠 10초 → 사이드바 경계 드래그 10초. 사용자가 컴퓨터 유즈 대신 CDP를 골랐다 |
| 기록 | `startedAt 2026-11-26T14:29:03.625Z`(`lockedAt` 뒤) · 86초 · 이벤트 1,790,199 · trace SHA-256 `trace-sha256.txt`(파일은 저장소 밖, 360MB) |
| 주 스레드 | 표식 pid 240852 / tid 317312 · 프레임 2,170(표시 2,085 · 누락 85) — 10초 창마다 약 600 프레임(60Hz) |

| 지표(관측) | 값 | D-109 규칙 | 메모 |
|---|---|---|---|
| `longest-stall-ms` | 339.1ms 1건 | ② ≥160ms 0건 | +17.1s(타이핑 끝 → 휠 시작) |
| `longest-consecutive-dropped` | 19 | ④ < 3 | 같은 +17.4s 구간 |
| `input-to-paint`(keydown·keypress·keyup) | 602건 · 최대 65.7ms | 기록 전용 | |
| `dropped-frames` | 85 | 기록 전용 | 0–10s 10 · 10–20s 55 · 20–30s 17 · 30–40s 3 |
| `tasks-over-50ms` | 1 | 기록 전용 | |

**남는 판단.** ① 합성 입력 run을 W 표본으로 셀지(W1은 실제 한글 IME를 전제한다 — 이 run은 note에 표시). ② +17.1s 339ms 정지는 반복 3·이전 빌드 짝을 모은 뒤에야 판정한다 — 파일럿 1회로 결함이라 하지 않는다.
