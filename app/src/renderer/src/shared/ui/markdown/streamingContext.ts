import { createContext } from 'react'

// 스트리밍 중 마크다운 서브트리 표시 — StreamingMarkdown 이 tail(미확정 꼬리) 렌더만
// true 로 감싼다. CodeBlock 이 이를 읽어 스트리밍 중 shiki 재하이라이트를 건너뛴다(0108):
// 열린 펜스는 stable 로 확정되지 않아 매 rAF 프레임 tail 에 남고, 프레임마다 자라는 코드
// 전체를 동기 codeToHtml 하면 스트리밍 전체로 O(n²) + plain↔색상 플리커가 난다.
export const MarkdownStreamingContext = createContext(false)
