// 커넥터 추가 메뉴 (0162) — 추가 버튼 아래에 **등록된 템플릿을 나열**한다.
//
// 사용자 요구: "플러그인 추가 버튼 클릭시 커넥터 항목들을 나열해야 한다 / 현재는 컨플루언스만".
// 0161 은 목록을 모달 안에 두었는데, 등록 템플릿이 1개면 그 단계가 통째로 건너뛰어져
// (`initialStep` 의 조건부 스킵) 사용자에게는 "나열이 없다" 로 보였다. 선택 책임을 여기로
// 옮기고 모달은 주소만 묻는다.
//
// skills 탭의 `SkillAddMenu` 와 같은 Popover·role 구조라 포커스·ESC 동작이 그대로 따라온다.

import { useEffect, useState, type RefObject } from 'react'
import { Popover } from '../../../../shared/ui/Popover'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { pluginApi } from '../../../../shared/api/ipc'
import type { ConnectorTemplateInfoDto } from '../../../../../../shared/ipc'
import { addMenuState } from '../../lib/connectorAddMenu'

export function ConnectorAddMenu({
  open,
  anchorRef,
  onClose,
  onPick
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onPick: (templateId: string) => void
}): React.JSX.Element | null {
  const { tr } = useI18n()
  // null = 아직 응답 전. 빈 배열(등록 0개)과 구분해야 로딩을 "없음" 으로 오보하지 않는다.
  const [templates, setTemplates] = useState<ConnectorTemplateInfoDto[] | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    void pluginApi.templates().then((list) => {
      if (alive) setTemplates(list)
    })
    return () => {
      alive = false
    }
  }, [open])

  const state = addMenuState(templates, (key) => tr(key as never))

  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} placement="bottom">
      <div role="menu" className="min-w-[220px] p-1">
        {state.kind === 'loading' ? (
          <div className="px-p5 py-p3 text-footnote text-ink3">{tr('common.loading')}</div>
        ) : state.kind === 'empty' ? (
          <div className="px-p5 py-p3 text-footnote text-ink3">
            {tr('skills.instance.noTemplate')}
          </div>
        ) : (
          state.rows.map((row) => (
            <button
              key={row.templateId}
              type="button"
              role="menuitem"
              onClick={() => {
                onClose()
                onPick(row.templateId)
              }}
              className="flex w-full cursor-pointer items-center gap-g5 rounded-r4 border-0 bg-transparent px-p5 py-p3 text-left text-footnote text-ink hover:bg-fill-uncontained-hover"
            >
              <Icon name="link" size={14} color="var(--color-ink2)" />
              <span className="flex-1">{row.label}</span>
            </button>
          ))
        )}
      </div>
    </Popover>
  )
}
