// '+' 메뉴 동작의 컨트롤러 순서(0259 D-002·D-003 · r1 verify D1) — 메뉴를 닫고, 파일 추가는 선택 창을
// 열고, 스킬·플러그인은 커서 자리에 토큰을 넣은 뒤 그 뒤로 커서를 옮긴다. 컨트롤러는 자기 상태 접근만
// 주입하고 이 함수를 부른다 — 테스트가 같은 함수를 실제 스냅샷 규칙으로 구동한다.
import { insertComposerToken } from '../../../lib/composerToken'
import { attachMenuToken, type AttachMenuAction } from '../../../lib/attachMenuModel'
import { replaceDraftRange, type DraftSnapshot } from './draftSnapshot'

export interface AttachMenuActionDeps {
  closeMenu: () => void
  pickAttachments: () => void
  compositionActive: () => boolean
  snapshot: () => DraftSnapshot
  updateSnapshot: (update: (current: DraftSnapshot) => DraftSnapshot) => void
  focus: (caret: number) => void
}

export function runAttachMenuAction(action: AttachMenuAction, deps: AttachMenuActionDeps): void {
  deps.closeMenu()
  if (action.type === 'attach') {
    deps.pickAttachments()
    return
  }
  const token = attachMenuToken(action)
  if (token === null || deps.compositionActive()) return
  const current = deps.snapshot()
  if (action.type === 'nativeCommand') {
    const prefix = `${token} `
    deps.updateSnapshot((value) => replaceDraftRange(value, current.revision, 0, 0, prefix))
    deps.focus(prefix.length)
    return
  }
  const inserted = insertComposerToken(current.text, current.selectionStart, token)
  deps.updateSnapshot((value) =>
    replaceDraftRange(value, current.revision, inserted.start, inserted.start, inserted.replacement)
  )
  deps.focus(inserted.caret)
}
