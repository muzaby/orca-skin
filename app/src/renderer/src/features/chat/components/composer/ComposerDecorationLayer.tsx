import { forwardRef, useDeferredValue, useMemo } from 'react'
import { tokenizeComposerDecoration } from './composerDecoration'
import type { DraftSnapshot } from './draftSnapshot'

interface ComposerDecorationLayerProps {
  snapshot: DraftSnapshot
  knownSkillNames: ReadonlySet<string>
  validFilePaths: ReadonlySet<string>
  typographyClassName: string
}

const EMPTY_SET: ReadonlySet<string> = new Set()

// 파생 장식은 native textarea 아래에 배경만 그린다. 실제 glyph와 caret은 textarea가
// 소유하므로 장식 계산이 늦거나 실패해도 입력 피드백은 지연되지 않는다.
export const ComposerDecorationLayer = forwardRef<HTMLDivElement, ComposerDecorationLayerProps>(
  function ComposerDecorationLayer(
    { snapshot, knownSkillNames = EMPTY_SET, validFilePaths = EMPTY_SET, typographyClassName },
    ref
  ): React.JSX.Element {
    const deferredSnapshot = useDeferredValue(snapshot)
    // native textarea가 glyph를 소유하므로 stale 파생값은 글자를 겹치지 않고 배경만 잠깐
    // 뒤따른다. revision이나 IME composition마다 layer를 숨기면 chip이 사라지므로 마지막으로
    // 완료된 장식을 유지하고 deferred 결과가 준비되면 원자적으로 교체한다.
    const segments = useMemo(
      () => tokenizeComposerDecoration(deferredSnapshot.text, knownSkillNames, validFilePaths),
      [deferredSnapshot.text, knownSkillNames, validFilePaths]
    )

    // viewport는 textarea와 같은 wrap width/gutter를 유지하고 clip만 담당한다. 실제 scroll
    // offset은 안쪽 projection에 transform으로 적용되어 decoration은 독립 offset을 소유하지 않는다.
    return (
      <div
        aria-hidden
        data-composer-decoration-viewport
        className={`${typographyClassName} pointer-events-none absolute inset-0 max-h-56 min-h-9 overflow-hidden text-transparent`}
      >
        <div ref={ref} data-composer-decoration-projection className="will-change-transform">
          {segments.map((segment, index) =>
            segment.kind === 'chip' ? (
              <span
                key={index}
                className={
                  segment.chip === 'skill'
                    ? 'rounded bg-blue-500/15 text-transparent'
                    : 'rounded bg-emerald-500/15 text-transparent'
                }
              >
                {segment.text}
              </span>
            ) : (
              <span key={index}>{segment.text}</span>
            )
          )}
          {deferredSnapshot.text.endsWith('\n') ? '\u200b' : ''}
        </div>
      </div>
    )
  }
)
