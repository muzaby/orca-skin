// 예약 작업의 main 전용 상한. renderer 가 보는 길이 상한·사유 코드는 `shared/scheduled-tasks.ts`.

export const SHELL_TIMEOUT_MS = 10 * 60 * 1000
// shell 출력은 이 크기의 꼬리만 이력에 남긴다.
export const OUTPUT_TAIL_BYTES = 64 * 1024
// 작업당 보관하는 실행 이력 수.
export const RUN_RETENTION = 50
// 이력 조회 한 번이 돌려주는 실행 수.
export const RUN_LIST_LIMIT = 20
// renderer 가 새 대화 시작 결과를 보고할 때까지 기다리는 시간.
export const PROMPT_REPORT_TIMEOUT_MS = 2 * 60 * 1000
