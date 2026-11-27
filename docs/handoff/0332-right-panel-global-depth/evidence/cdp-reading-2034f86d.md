# AC13 읽기 위치에서 패널 닫기 · CDP 진단 1회

2026-11-27, 제품 `2034f86d97af3735d7f8b715d7f78a5cc9213194`. 정본의 일반 모션에서 관측한 298ms 닫기 작업은 이번 진단 1회에서 재현되지 않았다. 정본은 128/130, exit 1이다. [정본의 두 모드 원본](panel-2034f86d.json)

Linux x64 · Xvfb · Electron 39.8.10 · CPU 0,1 · 1440×840 콘텐츠 영역 · renderer sandbox 활성 · backgroundThrottling 비활성 · 일반 모션. CDP 1.3의 V8 CPU 표본 간격은 2,000µs였다. `measureRightPanel` 장기 작업 관찰 창은 7,284.7ms, 이 창에 겹친 CPU 표본은 3,247개였다. 프로덕션 `probe.js`의 SHA-256은 `bb0db78ee3082fd7c630f389983717048bf0c27041c29d328774ff7d1c90a7df`다.

| renderer 관측 구간 | 구간 길이 | CPU 표본 | 구간에 겹친 최장 RunTask |
|---|---:|---:|---:|
| 읽기 휠 → closing | 109.6ms | 47 | 31.7ms |
| closing → closed | 200.5ms | 80 | 5.4ms |
| closed → 다시 opening | 194.6ms | 94 | 6.9ms |
| 읽기 휠 → 다시 opening 전체 | 504.7ms | 218 | 31.7ms |

전체 읽기 구간의 1.5ms 초과 Layout은 2건, 최장은 7.4ms였다. closing → closed 구간에서 이 기준을 넘은 Layout은 0건이었다. 호출자까지 대조한 결과, 읽기 구간과 전체 관찰 창 모두 `captureAnchor`, `partTextOffset`, `pointAtPartOffset`, `collectContentTextNodes`가 잡힌 CPU 표본은 0개였다. 이 실행으로 반복적인 텍스트 탐색 비용을 확인하지 못했다. [앵커 탐색](../../../../app/src/renderer/src/features/chat/lib/transcript/viewport/anchor.ts) · [문자 오프셋 탐색](../../../../app/src/renderer/src/features/chat/lib/transcript/viewport/textOffset.ts)

| 같은 실행에서 장기 작업이 시작된 단계 | 작업 길이 | 겹친 비용 |
|---|---:|---|
| resize-persistence | 79ms | 미측정 행의 `getBoundingClientRect` 표본 14.9ms, Layout 19.8ms |
| Claude Code → Claude Work | 69ms | 다음 OpenCode 전환에도 겹침. 미측정 행의 `getBoundingClientRect` 표본 25.9ms, Layout 23.7ms |
| Claude → OpenCode | 50ms | 검사기 `measureSessionSwitches`의 프레임 폭 조회 표본 10.5ms |
| Claude → OpenCode | 55ms | 다음 OpenCode 세션 전환에도 겹침. TanStack `getMeasurements` 표본 11.1ms, 미측정 행의 rect 표본 8.0ms |

표본 시간은 같은 호출 스택에 귀속된 구간 길이의 추정치다. Layout 이벤트가 같은 구간에 겹치므로 표본 시간과 합산하지 않는다. [행 실측](../../../../app/src/renderer/src/features/chat/components/transcript/TranscriptViewport.tsx) · [세션 전환 및 읽기 단계](../../../../app/scripts/right-panel/probe.tsx)

## 재현 절차

1. 위 제품 SHA의 `app`에서 프로젝트 의존성을 설치한다. `serveProbe('right-panel')`로 프로덕션 번들을 시작하고, 정본의 BrowserWindow 설정으로 반환된 origin을 연다. Linux에서는 `taskset -c 0,1 xvfb-run -a`로 진단 프로세스를 실행한다. [번들 생성기](../../../../app/scripts/check-transcript-selection.mjs) · [창 설정과 모션 설정](../../../../app/scripts/right-panel/electron-main.mjs)
2. 폰트 준비와 한 프레임을 기다린 뒤 `webContents.debugger.attach('1.3')` 및 `Emulation.setEmulatedMedia`로 `prefers-reduced-motion: no-preference`를 설정한다. `Profiler.enable`, `Profiler.setSamplingInterval({interval: 2000})`, `Tracing.start`, `Profiler.start` 순으로 시작한다. trace 범주는 `devtools.timeline,disabled-by-default-devtools.timeline,v8,blink.user_timing,toplevel`다.
3. 장기 작업 observer의 시작과 disconnect, 읽기 휠(`deltaY === -500`), 패널 `data-phase`의 closing·closed·opening 변경을 표시할 `performance.mark` 리스너를 연결한 다음 `window.measureRightPanel()`을 한 번 실행한다. observer의 disconnect에서 CPU 및 trace 수집을 멈춘다. 시작 mark로 renderer 시간과 CDP 시간을 맞춰 해당 main thread의 RunTask 및 V8 표본을 비교한다. 정본 판정은 `xvfb-run -a node scripts/check-right-panel.mjs`로 재현한다. [정본 판정기](../../../../app/scripts/check-right-panel.mjs)
