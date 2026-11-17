// 실행 없이 읽는 OpenCode 구성 — 설정 파일·모델 파서·스킬 폴더 (0324 EP-1 (e3)).
//
// 데이터 호스트(상태)는 하네스 설정 트리와 스킬 목록을 읽지만 어댑터·서버·SDK 를 번들에 넣지 않는다.
// `./index.ts` 는 구현 묶음(`v1` — 어댑터·서버 풀)을 끌어오므로, 실행이 필요 없는 소비자는 여기로 온다.
// 이 파일에 프로세스 기동·SDK 에 닿는 export 를 더하면 가드 (e3) 가 실패한다.
export {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  parseOpenCodeRuntimeModels
} from './v1/settings'
export { openCodeSkillDirectories } from './v1/skill-sources'
export { configuredOpenCodePluginSkillDirectories as openCodePluginSkillDirectories } from './v1/configured-resources'
