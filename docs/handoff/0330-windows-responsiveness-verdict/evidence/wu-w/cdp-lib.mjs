// 0330 러너 공용 — 권한·계획·질문 카드 처리기와 큰 trace 분할 저장.
import { closeSync, openSync, writeSync } from 'node:fs'

// 페이지 안 감시자: 컴포저 위에 뜨는 카드를 자동 처리하고 기록한다(window.__ooCards).
// 도구 실행 승인 → '거부'(에이전트가 글로 답하게 — 측정 프롬프트는 도구가 필요 없다) · 계획 승인 → '수락' · 명확화 질문 → '건너뛰기'.
// policy 'allow' 면 도구 승인을 '허용'으로 누른다(W3 처럼 도구 호출이 시나리오인 경우).
export const cardGuard = (policy = 'deny') => `(()=>{if(window.__ooCardGuard)return 'already';window.__ooCards=[];window.__ooCardGuard=true;
  const act=()=>{for(const [aria,label] of [['도구 실행 승인',${JSON.stringify(policy === 'allow' ? '허용' : '거부')}],['계획 승인','수락'],['명확화 질문','건너뛰기']]){
    for(const card of document.querySelectorAll('[aria-label="'+aria+'"]')){if(card.__ooHandled)continue;const btn=[...card.querySelectorAll('button')].find(b=>b.innerText.trim()===label);
      if(btn){card.__ooHandled=true;window.__ooCards.push({kind:aria,action:label,at:performance.now(),text:card.innerText.slice(0,80)});btn.click()}}}};
  new MutationObserver(act).observe(document.body,{childList:true,subtree:true});act();return 'armed'})()`
export const cardsTaken = 'window.__ooCards??[]'

// JSON.stringify 한 번으로는 수백 MB trace 가 'Invalid string length'로 실패한다 — 이벤트를 묶음으로 나눠 쓴다.
export function writeTrace(file, events, metadata) {
  const fd = openSync(file, 'w')
  try {
    writeSync(fd, '{"traceEvents":[')
    const CHUNK = 20000
    for (let i = 0; i < events.length; i += CHUNK) {
      const part = events.slice(i, i + CHUNK).map((e) => JSON.stringify(e)).join(',')
      writeSync(fd, (i ? ',' : '') + part)
    }
    writeSync(fd, '],"metadata":' + JSON.stringify(metadata) + '}')
  } finally {
    closeSync(fd)
  }
}
