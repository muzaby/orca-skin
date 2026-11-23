import { useMemo, useRef, type RefObject } from 'react'
import { VirtualCodeView } from '../../../components/code/VirtualCodeView'
import { countLinesUpTo } from '../../../../../shared/compute/diffModel'
import { VIRTUAL_BODY_MIN_LINES } from '../../../../../shared/ui/virtual/limits'
import { useI18n } from '../../../../../shared/i18n'
import { CodeBlock } from '../../../../../shared/ui/markdown/CodeBlock'
import {
  hasWorkToolRequest,
  workSearchResults,
  workToolPayload,
  workToolPresentation
} from '../../../lib/workToolPresentation'
import type { WorkToolPayload } from '../../../lib/workToolPresentation'
import type { ToolCall } from '../../../reducer/chatReducer'
import { isTaskListToolName } from '../../../../../../../shared/task-tool'
import { TaskToolBody } from './tool-bodies/TaskToolBody'

function Payload({
  payload,
  documentId,
  revisionSource,
  scrollElement,
  error = false
}: {
  scrollElement: RefObject<HTMLDivElement | null>
  revisionSource?: object
  documentId: string
  payload: WorkToolPayload
  error?: boolean
}): React.JSX.Element {
  const { tr } = useI18n()
  const large = useMemo(
    () => countLinesUpTo(payload.text, VIRTUAL_BODY_MIN_LINES) > VIRTUAL_BODY_MIN_LINES,
    [payload.text]
  )
  return (
    <div
      className={`[&_pre]:bg-transparent! ${error ? '[&_pre]:text-bad! [&_span]:text-bad!' : ''}`}
    >
      {payload.text === '' ? (
        <p className="px-3 py-2 text-caption text-ink3">{tr('chat.workTool.empty')}</p>
      ) : large ? (
        <VirtualCodeView
          documentId={documentId}
          revisionSource={revisionSource ?? payload}
          code={payload.text}
          lang={payload.language}
          scrollElement={scrollElement}
        />
      ) : (
        <CodeBlock code={payload.text} lang={payload.language} embedded showHeader={false} />
      )}
    </div>
  )
}

// 원문 입력/결과를 보존한 Work 전용 본문. MCP와 미지 도구도 동일한 안전한 텍스트 경로다.
export function WorkToolBody({ call }: { call: ToolCall }): React.JSX.Element {
  const { tr } = useI18n()
  const scrollElement = useRef<HTMLDivElement>(null)
  const failed = useMemo(() => workToolPresentation(call).status === 'failed', [call])
  const links = useMemo(() => workSearchResults(call), [call])
  const taskTool = isTaskListToolName(call.name)
  // Task 도구의 모델용 receipt와 UI용 구조화 결과는 다른 정보다. 의미 표시는 기존
  // TaskToolBody가 맡고, 원문 disclosure에는 둘 다 남긴다.
  const result = call.result
  const requestPayload = useMemo(() => workToolPayload(call.input), [call.input])
  const responsePayload = useMemo(
    () =>
      workToolPayload(
        taskTool && result?.structuredOutput !== undefined
          ? { structuredOutput: result.structuredOutput, output: result.output }
          : result?.output
      ),
    [result, taskTool]
  )
  return (
    <div
      ref={scrollElement}
      tabIndex={0}
      className="max-h-[250px] space-y-2 overflow-auto overscroll-contain rounded-r6 border border-border bg-bg p-2 text-caption outline-none ring-focus"
      data-work-tool-body={call.toolUseId}
    >
      {hasWorkToolRequest(call.input) && (
        <section aria-label={tr('chat.workTool.request')} className="rounded-r4 bg-bg2">
          <h4 className="px-3 pt-2 font-medium text-ink3">{tr('chat.workTool.request')}</h4>
          <Payload
            scrollElement={scrollElement}
            revisionSource={
              typeof call.input === 'object' && call.input !== null ? call.input : undefined
            }
            documentId={'tool:' + call.toolUseId + ':work:request'}
            payload={requestPayload}
          />
        </section>
      )}
      <section
        aria-label={tr(failed ? 'chat.workTool.error' : 'chat.workTool.response')}
        className={`rounded-r4 ${failed ? 'bg-bad/5' : 'bg-bg2'}`}
      >
        <h4 className={`px-3 pt-2 font-medium ${failed ? 'text-bad' : 'text-ink3'}`}>
          {tr(failed ? 'chat.workTool.error' : 'chat.workTool.response')}
        </h4>
        {taskTool && call.result && (
          <div className="px-3 pt-2">
            <TaskToolBody call={call} />
          </div>
        )}
        {links.length > 0 && (
          <div className="px-3 pt-2">
            <p className="mb-1.5 text-ink3">
              {tr('chat.workTool.resultsCount', { count: links.length })}
            </p>
            <ul aria-label={tr('chat.workTool.results')} className="space-y-1">
              {links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/work-search flex min-w-0 items-baseline gap-3 rounded-r4 py-1 text-ink2 outline-none ring-focus hover:text-ink"
                  >
                    <span className="min-w-0 flex-1 truncate group-hover/work-search:underline">
                      {link.title}
                    </span>
                    <span className="max-w-[40%] shrink-0 truncate text-ink3">
                      {new URL(link.url).hostname}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {call.result ? (
          links.length > 0 || taskTool ? (
            <details className="pb-1">
              <summary className="cursor-pointer px-3 py-2 text-ink3 outline-none ring-focus">
                {tr('chat.workTool.rawResponse')}
              </summary>
              <Payload
                scrollElement={scrollElement}
                revisionSource={call.result}
                documentId={'tool:' + call.toolUseId + ':work:response'}
                payload={responsePayload}
                error={failed}
              />
            </details>
          ) : (
            <Payload
              scrollElement={scrollElement}
              revisionSource={call.result}
              documentId={'tool:' + call.toolUseId + ':work:response'}
              payload={responsePayload}
              error={failed}
            />
          )
        ) : (
          <p className="px-3 py-2 text-ink3" role="status">
            {tr('chat.workTool.running')}
          </p>
        )}
      </section>
    </div>
  )
}
