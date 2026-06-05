// ToolRendererRegistry — 도구 본문 렌더링을 도구 이름 switch 대신 시맨틱 RenderableKind 로 해소한다
// (rendering.md §1.6). 새 도구/엔진은 도구이름 분기를 늘리는 대신 renderer 를 register 한다.
// match 는 도구 이름(provider 중립) 기준 — OpenCode 도구도 같은 kind 로 매핑된다(seam).
//
// 매칭 로직(resolve)은 순수 함수라 단위 테스트 대상. Body 는 JSX 를 반환하는 컴포넌트 참조.

import type { ToolCall } from '../../reducer/chatReducer'
import { BashBody } from './tool-bodies/BashBody'
import { DiffBody } from './tool-bodies/DiffBody'
import { FileBody } from './tool-bodies/FileBody'
import { AskBody } from './tool-bodies/AskBody'
import { KeyValueBody } from './tool-bodies/KeyValueBody'

// 도구 본문의 시맨틱 종류. provider 중립 — 도구 이름이 아니라 "무엇을 보여주는가" 로 분류.
export type RenderableKind = 'command' | 'file_edit' | 'file_read' | 'ask' | 'generic'

export interface ToolRenderer {
  kind: RenderableKind
  match: (toolName: string) => boolean
  Body: (props: { call: ToolCall }) => React.JSX.Element
}

export class ToolRendererRegistry {
  private readonly renderers: ToolRenderer[] = []

  // 미지 도구의 폴백(타 SDK 도 합리적 렌더). 생성 시 필수.
  constructor(private readonly fallback: ToolRenderer) {}

  register(r: ToolRenderer): this {
    this.renderers.push(r)
    return this
  }

  // 첫 match 를 반환, 없으면 fallback. 등록 순서가 우선순위.
  resolve(toolName: string): ToolRenderer {
    return this.renderers.find((r) => r.match(toolName)) ?? this.fallback
  }
}

const FILE_EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit'])

// 기본 레지스트리 — 현행 ToolCard switch 와 동치. fallback=generic(KeyValueBody).
export const toolRendererRegistry = new ToolRendererRegistry({
  kind: 'generic',
  match: () => true,
  Body: KeyValueBody
})
  .register({ kind: 'command', match: (n) => n === 'Bash' || n === 'PowerShell', Body: BashBody })
  .register({ kind: 'file_edit', match: (n) => FILE_EDIT_TOOLS.has(n), Body: DiffBody })
  .register({ kind: 'file_read', match: (n) => n === 'Read', Body: FileBody })
  .register({ kind: 'ask', match: (n) => n === 'AskUserQuestion', Body: AskBody })
