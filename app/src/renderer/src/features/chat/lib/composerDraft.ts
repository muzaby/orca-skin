// 세션을 소유한 producer가 발급하고 입력 컨트롤러가 한 번 소비하는 편집 신호.
export interface ComposerDraftUpdate {
  id: number
  text: string
  mode?: 'replace' | 'append'
}

let draftSequence = 0

export function nextComposerDraftSequence(): number {
  return ++draftSequence
}
