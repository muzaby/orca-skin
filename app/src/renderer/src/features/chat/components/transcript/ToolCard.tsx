import { useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { CopyIconButton } from '../../../../shared/ui/CopyIconButton'
import {
  VERB_LABEL,
  VERB_LABEL_ACTIVE,
  toolDescription,
  toolDiffStat,
  toolVerbCategory
} from '../../lib/toolMeta'
import { extToLang, stripLineNumberGutter } from '../../lib/lang'
import { stringify } from '../../format'
import { CodeBlock } from '../markdown/CodeBlock'
import { BashBody } from './tool-bodies/BashBody'
import { DiffBody } from './tool-bodies/DiffBody'
import { KeyValueBody } from './tool-bodies/KeyValueBody'
import { AskBody } from './tool-bodies/AskBody'
import type { ToolCall } from '../../reducer/chatReducer'

const FILE_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit'])

// result.output 을 문자열로.
function resultOutput(call: ToolCall): string {
  const o = call.result?.output
  return o == null ? '' : typeof o === 'string' ? o : stringify(o)
}

// 본문 헤더 레이블 — 파일 도구는 file_path 전체(절대경로), 그 외는 도구 이름.
function headerLabel(call: ToolCall): string {
  const rec = call.input as { file_path?: unknown } | null
  const fp = typeof rec?.file_path === 'string' ? rec.file_path : null
  return FILE_TOOLS.has(call.name) && fp ? fp : call.name
}

// 헤더 복사 버튼의 복사 대상(도구별).
function copyText(call: ToolCall): string {
  const rec =
    typeof call.input === 'object' && call.input !== null
      ? (call.input as Record<string, unknown>)
      : {}
  switch (call.name) {
    case 'Bash':
    case 'PowerShell': {
      const command = typeof rec.command === 'string' ? rec.command : stringify(call.input)
      const out = resultOutput(call)
      return `$ ${command}` + (out.trim() !== '' ? `\n${out}` : '')
    }
    case 'Write':
      return typeof rec.content === 'string' ? rec.content : stringify(call.input)
    case 'Read':
    case 'Edit':
    case 'MultiEdit':
      return resultOutput(call)
    default: {
      const out = resultOutput(call)
      return out.trim() !== '' ? out : stringify(call.input)
    }
  }
}

// Read 본문 — result.output 을 cat -n 거터 제거 후 언어 헤더 없는 코드블록으로(라인넘버).
function FileBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : null
  const lang = filePath ? extToLang(filePath) : undefined
  const output = resultOutput(call)
  if (call.result && output.trim() !== '') {
    return (
      <CodeBlock
        code={stripLineNumberGutter(output)}
        lang={lang}
        showLineNumbers
        showHeader={false}
        embedded
      />
    )
  }
  return (
    <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
      {stringify(call.input)}
    </pre>
  )
}

// 도구별 본문 디스패치. 미지 도구는 KeyValueBody 로 폴백(타 SDK 도 합리적 렌더).
function ToolBody({ call }: { call: ToolCall }): React.JSX.Element {
  switch (call.name) {
    case 'Bash':
    case 'PowerShell':
      return <BashBody call={call} />
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return <DiffBody call={call} />
    case 'Read':
      return <FileBody call={call} />
    case 'AskUserQuestion':
      return <AskBody call={call} />
    default:
      return <KeyValueBody call={call} />
  }
}

// 전략문서 5.4 양식 — 카드가 아니라 *행*. 동사→이름→diff→chevron(마지막).
// 펼침 본문(코드/diff)만 recessed 블록. `inGroup` 이면 그룹 카드(bg-bg) 위라
// 본문은 테두리로만 구분, standalone 이면 본문이 bg-bg recessed.
export function ToolCard({
  call,
  inGroup = false
}: {
  call: ToolCall
  inGroup?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // 최초 오픈 후엔 본문을 계속 마운트 유지 → 닫힘도 grid-rows 전환으로 애니메이션.
  // 한 번도 안 연 카드는 본문 미마운트(shiki 등 선렌더 비용 회피).
  const [wasOpened, setWasOpened] = useState(false)
  const toggle = (): void => {
    setOpen((v) => !v)
    setWasOpened(true)
  }
  const done = call.result != null
  const isError = call.result?.isError === true
  const cat = toolVerbCategory(call.name)
  // 진행 중이면 진행 시제(읽는 중…), 완료되면 완료 시제(읽음).
  const verb = done ? VERB_LABEL[cat] : VERB_LABEL_ACTIVE[cat]
  const description = toolDescription(call)
  const stat = toolDiffStat(call)
  return (
    <div className="flex w-full flex-col">
      {/* 행: [동사] [서술] (+N-M) [chevron] — chevron 은 마지막 (전략 5.4) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className="group/tool flex max-w-full cursor-pointer items-center gap-g2 self-start text-left text-body text-t6 outline-none hide-focus-ring ring-focus"
      >
        <span
          className={`shrink-0 ${
            isError ? 'text-rust' : done ? 'group-hover/tool:text-t9' : 'epitaxy-text-shine'
          }`}
        >
          {verb}
        </span>
        {!done && <span className="sr-only">실행 중</span>}
        <span className="min-w-0 truncate group-hover/tool:text-t9">{description}</span>
        {stat && (stat.added > 0 || stat.removed > 0) && (
          <span className="shrink-0 font-mono text-caption tabular-nums">
            {stat.added > 0 && <span className="text-extended-green">+{stat.added}</span>}
            {stat.removed > 0 && <span className="ml-1 text-extended-pink">-{stat.removed}</span>}
          </span>
        )}
        <span aria-hidden className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>
          <Icon name="chevR" size={12} />
        </span>
      </div>
      {/* 펼침 본문 — grid-rows 0fr↔1fr 전환으로 height+opacity 애니메이션(JS scrollHeight 불요) */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {(open || wasOpened) && (
            <div
              className={`group/toolbody mt-g2 overflow-hidden rounded-r4 font-mono text-footnote text-t9 ${
                inGroup ? 'border border-t5' : 'bg-bg'
              }`}
            >
              <div className="px-p5 py-p4">
                {/* 본문 헤더(경로/도구명 + 우측 복사) — 모든 도구 공통, 복사버튼 항상 노출.
                    ToolBody 내부의 중복 헤더(DiffBody 경로 줄/CodeBlock 언어 헤더)는 제거됨. */}
                <div className="mb-g3 flex items-center gap-g3 font-sans text-caption text-t6">
                  <span
                    className={`min-w-0 truncate font-semibold ${isError ? 'text-rust' : 'text-t7'}`}
                  >
                    {headerLabel(call)}
                  </span>
                  <div className="ml-auto shrink-0">
                    <CopyIconButton text={copyText(call)} title="복사" />
                  </div>
                </div>
                <ToolBody call={call} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
