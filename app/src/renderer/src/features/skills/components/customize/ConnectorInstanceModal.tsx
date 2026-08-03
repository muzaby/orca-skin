// 서버 추가 모달 (0161·0162) — 주소 입력 → 생성.
//
// 사용자 요구: "추가 버튼 클릭 시 컨플루언스를 선택, base url·pat 혹은 id/passwd 입력".
// **템플릿 선택은 이 모달이 하지 않는다** — 추가 메뉴(`ConnectorAddMenu`, 0162)가 이미 끝냈고
// `templateId` 로 넘어온다. 필수 prop 이라 템플릿 없이 이 모달을 여는 경로는 컴파일되지 않는다.
// 자격증명 입력은 **생성 직후** 0160 의 `ConnectorConnectModal` 이 이어받는다 — 이 모달은
// 서버를 만들 뿐이고, 인증이 실패해도 서버는 남는다(카탈로그에서 다시 연결).
//
// **주소는 만든 뒤 고칠 수 없다.** connector ID 가 주소에서 파생되고 그 ID 에서 도구 이름·
// 승인 키·다운로드 경로가 나오기 때문이다. 그 사실을 생성 **전에** 알린다.
//
// **주소 칸은 하나다** (0163). 0161 은 origin 과 컨텍스트 경로를 따로 물었는데 사용자가
// "이해할 수 없는 옵션" 이라고 보고했다. 브라우저 주소창의 URL 을 그대로 받고 앱이 쪼갠다 —
// 무엇이 적용되는지는 입력 아래에 되보여준다.

import { useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Modal, MODAL_INPUT, MODAL_LABEL } from '../../../../shared/ui/Modal'
import { useI18n } from '../../../../shared/i18n'
import { pluginApi } from '../../../../shared/api/ipc'
import type { PluginConnectorInfo } from '../../../../../../shared/ipc'
import {
  classifyCreateFailure,
  describeApiBase,
  draftForTemplate,
  splitServerUrl,
  toCreateRequest,
  validateDraft,
  type CreateFailure,
  type DraftProblem,
  type InstanceDraft
} from '../../lib/connectorInstance'

const PROBLEM_KEY = {
  template_required: 'skills.instance.errTemplate',
  label_required: 'skills.instance.errLabel',
  address_invalid: 'skills.instance.errAddress'
} as const satisfies Record<DraftProblem, string>

const FAILURE_KEY = {
  already_exists: 'skills.instance.errExists',
  invalid_input: 'skills.instance.errAddress',
  unknown_template: 'skills.instance.errTemplate',
  register_failed: 'skills.instance.errRegister',
  unknown: 'skills.instance.errUnknown'
} as const satisfies Record<CreateFailure, string>

export function ConnectorInstanceModal({
  open,
  templateId,
  onClose,
  onCreated
}: {
  open: boolean
  // 추가 메뉴가 고른 템플릿. 선택 없이 열 수 없다는 것을 타입으로 강제한다.
  templateId: string
  onClose: () => void
  // 생성 응답(갱신된 **목록 전체**)을 그대로 넘긴다 — 어느 것이 새것인지는 호출부가
  // 이전 목록과의 차집합으로 정한다(0163 `connectorCreate.ts`). 0162 는 여기서 origin
  // 문자열로 찾아 매칭이 어긋나면 목록 갱신까지 통째로 건너뛰었다.
  onCreated: (connectors: PluginConnectorInfo[]) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [draft, setDraft] = useState<InstanceDraft>(() => draftForTemplate(templateId))
  const [problem, setProblem] = useState<DraftProblem | null>(null)
  const [failure, setFailure] = useState<CreateFailure | null>(null)
  const [busy, setBusy] = useState(false)

  // 초기화 effect 를 두지 않는다 — 호출부가 템플릿을 고른 동안에만 이 모달을 **마운트**하므로
  // (`ExtensionsCatalogView`), 다시 열면 컴포넌트가 새로 만들어져 위 초기값이 그대로 적용된다.

  const close = (): void => {
    setProblem(null)
    setFailure(null)
    setBusy(false)
    onClose()
  }

  // 입력값은 **손대지 않는다.** 0162 는 매 키 입력마다 origin 으로 되썼는데, 그 탓에
  // `https://wiki.corp/` 의 `/` 가 지워져 이어 치면 `https://wiki.corpconfluence` 가 됐다.
  // 쪼개는 것은 제출할 때 한 번이면 충분하다.
  const address = splitServerUrl(draft.address)

  const submit = (): void => {
    const found = validateDraft(draft)
    setProblem(found)
    setFailure(null)
    if (found !== null) return

    const request = toCreateRequest(draft)
    if (request === null) {
      setProblem('address_invalid')
      return
    }

    setBusy(true)
    void pluginApi
      .createInstance(request)
      .then((connectors) => {
        close()
        onCreated(connectors)
      })
      .catch((error: unknown) => setFailure(classifyCreateFailure(error)))
      .finally(() => setBusy(false))
  }

  return (
    <Modal
      open={open}
      title={tr('skills.instance.title')}
      onClose={close}
      busy={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="uncontained" onClick={close} disabled={busy}>
            {tr('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} busy={busy}>
            {tr('skills.instance.create')}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy) submit()
        }}
      >
        <label className="block">
          <div className={MODAL_LABEL}>{tr('skills.instance.label')}</div>
          <input
            className={MODAL_INPUT}
            value={draft.label}
            disabled={busy}
            placeholder={tr('skills.instance.labelPlaceholder')}
            onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
          />
        </label>

        <label className="block">
          <div className={MODAL_LABEL}>{tr('skills.instance.address')}</div>
          <input
            className={MODAL_INPUT}
            value={draft.address}
            disabled={busy}
            placeholder="https://wiki.example.com/confluence"
            onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
          />
          <p className="mt-g1 text-caption text-ink3">{tr('skills.instance.addressHint')}</p>
          {/* 앱이 실제로 쓸 주소를 되보여준다 — 자동 해석을 숨기지 않는다. */}
          {address !== null && (
            <p className="mt-g1 text-caption text-ink2">
              {tr('skills.instance.addressResolved', { url: describeApiBase(address) })}
            </p>
          )}
        </label>

        {(problem !== null || failure !== null) && (
          <p role="alert" className="text-footnote text-bad">
            {tr(problem !== null ? PROBLEM_KEY[problem] : FAILURE_KEY[failure ?? 'unknown'])}
          </p>
        )}
        {/* Enter 제출용 — 시각 버튼은 footer 하나만 둔다. */}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  )
}
