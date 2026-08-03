// 서버 추가 모달 (0161) — 템플릿 선택 → 주소 입력 → 생성.
//
// 사용자 요구: "추가 버튼 클릭 시 컨플루언스를 선택, base url·pat 혹은 id/passwd 입력".
// 자격증명 입력은 **생성 직후** 0160 의 `ConnectorConnectModal` 이 이어받는다 — 이 모달은
// 서버를 만들 뿐이고, 인증이 실패해도 서버는 남는다(카탈로그에서 다시 연결).
//
// **주소는 만든 뒤 고칠 수 없다.** connector ID 가 주소에서 파생되고 그 ID 에서 도구 이름·
// 승인 키·다운로드 경로가 나오기 때문이다. 그 사실을 생성 **전에** 알린다.

import { useEffect, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Modal, MODAL_INPUT, MODAL_LABEL } from '../../../../shared/ui/Modal'
import { useI18n } from '../../../../shared/i18n'
import { pluginApi } from '../../../../shared/api/ipc'
import type { ConnectorTemplateInfoDto, PluginConnectorInfo } from '../../../../../../shared/ipc'
import {
  classifyCreateFailure,
  initialDraft,
  initialStep,
  splitPastedUrl,
  toCreateRequest,
  validateDraft,
  type CreateFailure,
  type DraftProblem,
  type InstanceDraft,
  type InstanceStep
} from '../../lib/connectorInstance'

const PROBLEM_KEY = {
  template_required: 'skills.instance.errTemplate',
  label_required: 'skills.instance.errLabel',
  base_url_invalid: 'skills.instance.errBaseUrl',
  api_base_path_invalid: 'skills.instance.errBasePath'
} as const satisfies Record<DraftProblem, string>

const FAILURE_KEY = {
  already_exists: 'skills.instance.errExists',
  invalid_input: 'skills.instance.errBaseUrl',
  unknown_template: 'skills.instance.errTemplate',
  register_failed: 'skills.instance.errRegister',
  unknown: 'skills.instance.errUnknown'
} as const satisfies Record<CreateFailure, string>

// 템플릿 라벨은 main 이 **i18n 키**로 선언하고 renderer 카탈로그가 문구를 갖는다(UI 문구는
// renderer 소유라는 저장소 규약). 키가 카탈로그에 없으면 i18next 는 키 자체를 돌려주므로,
// 그때는 templateId 로 낮춰 사용자가 최소한 무엇인지 알 수 있게 한다.
function templateLabel(
  tr: ReturnType<typeof useI18n>['tr'],
  template: ConnectorTemplateInfoDto
): string {
  const resolved = tr(template.i18nKey as never)
  return resolved === template.i18nKey ? template.templateId : resolved
}

export function ConnectorInstanceModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean
  onClose: () => void
  // 만들어진 connector 를 넘겨 호출부가 곧바로 인증 모달을 띄운다.
  onCreated: (connector: PluginConnectorInfo) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [templates, setTemplates] = useState<ConnectorTemplateInfoDto[]>([])
  const [step, setStep] = useState<InstanceStep>('template')
  const [draft, setDraft] = useState<InstanceDraft>(initialDraft([]))
  const [problem, setProblem] = useState<DraftProblem | null>(null)
  const [failure, setFailure] = useState<CreateFailure | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    void pluginApi.templates().then((list) => {
      if (!alive) return
      setTemplates(list)
      setStep(initialStep(list))
      setDraft(initialDraft(list))
    })
    return () => {
      alive = false
    }
  }, [open])

  const close = (): void => {
    setProblem(null)
    setFailure(null)
    setBusy(false)
    onClose()
  }

  // 주소를 붙여넣는 순간 origin 과 컨텍스트 경로를 갈라 **제안**한다. 자동 확정하지 않는다 —
  // `/display` 를 컨텍스트 경로로 오인하면 모든 요청이 404 가 된다.
  const onBaseUrlChange = (value: string): void => {
    const parts = splitPastedUrl(value)
    if (parts !== null && parts.origin !== value) {
      setDraft((prev) => ({
        ...prev,
        baseUrl: parts.origin,
        apiBasePath: prev.apiBasePath === '' ? parts.suggestedBasePath : prev.apiBasePath
      }))
      return
    }
    setDraft((prev) => ({ ...prev, baseUrl: value }))
  }

  const submit = (): void => {
    const found = validateDraft(draft)
    setProblem(found)
    setFailure(null)
    if (found !== null) return

    setBusy(true)
    void pluginApi
      .createInstance(toCreateRequest(draft))
      .then((connectors) => {
        const created = connectors.find(
          (item) => item.origin === draft.baseUrl.trim() && item.source === 'instance'
        )
        close()
        if (created) onCreated(created)
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
          {step === 'server' && (
            <Button variant="primary" onClick={submit} busy={busy}>
              {tr('skills.instance.create')}
            </Button>
          )}
        </div>
      }
    >
      {step === 'template' ? (
        <div className="flex flex-col gap-3">
          <div className={MODAL_LABEL}>{tr('skills.instance.pickTemplate')}</div>
          {templates.length === 0 ? (
            <p role="alert" className="text-footnote text-bad">
              {tr('skills.instance.noTemplate')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Button
                  key={template.templateId}
                  variant="contained"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, templateId: template.templateId }))
                    setStep('server')
                  }}
                >
                  {templateLabel(tr, template)}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
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
            <div className={MODAL_LABEL}>{tr('skills.instance.baseUrl')}</div>
            <input
              className={MODAL_INPUT}
              value={draft.baseUrl}
              disabled={busy}
              placeholder="https://wiki.example.com"
              onChange={(event) => onBaseUrlChange(event.target.value)}
            />
            {/* 생성 전에 알린다 — 나중에 고칠 수 없다는 사실이 입력 순간의 정보다. */}
            <p className="mt-g1 text-caption text-ink3">{tr('skills.instance.baseUrlHint')}</p>
          </label>

          <label className="block">
            <div className={MODAL_LABEL}>{tr('skills.instance.apiBasePath')}</div>
            <input
              className={MODAL_INPUT}
              value={draft.apiBasePath}
              disabled={busy}
              placeholder="/confluence"
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, apiBasePath: event.target.value }))
              }
            />
            <p className="mt-g1 text-caption text-ink3">{tr('skills.instance.apiBasePathHint')}</p>
          </label>

          {(problem !== null || failure !== null) && (
            <p role="alert" className="text-footnote text-bad">
              {tr(problem !== null ? PROBLEM_KEY[problem] : FAILURE_KEY[failure ?? 'unknown'])}
            </p>
          )}
          {/* Enter 제출용 — 시각 버튼은 footer 하나만 둔다. */}
          <button type="submit" className="hidden" aria-hidden />
        </form>
      )}
    </Modal>
  )
}
