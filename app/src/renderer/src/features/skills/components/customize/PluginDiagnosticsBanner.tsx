// 등록 거부 배너 (0164 r2) — "servers.ts 에 구성했는데 플러그인 UI 에 없다" 를 끝내는 화면.
//
// 패키지 등록은 all-or-nothing 이다. `baseUrl` 이 경로를 달고 있거나 끝에 `/` 가 붙으면 그
// 패키지의 provider·connector 가 **전부** 거부되는데, 지금까지 흔적이 main 의 warn 로그뿐이라
// 화면에는 아무 일도 없던 것처럼 보였다. 목록 위에 사유를 그대로 올린다.

import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import type { PluginDiagnostic } from '../../../../../../shared/ipc'

export function PluginDiagnosticsBanner({
  diagnostics
}: {
  diagnostics: readonly PluginDiagnostic[]
}): React.JSX.Element | null {
  const { tr } = useI18n()
  if (diagnostics.length === 0) return null

  return (
    <div
      className="mb-3 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm"
      role="status"
      data-context="plugin-diagnostics"
    >
      <div className="flex items-center gap-2 font-medium text-ink">
        <Icon name="alert" className="size-4 text-warn" />
        {tr('skills.diagnostics.title', { count: String(diagnostics.length) })}
      </div>
      <p className="mt-1 text-ink3">{tr('skills.diagnostics.hint')}</p>
      <ul className="mt-2 space-y-1">
        {diagnostics.map((item, index) => (
          <li key={`${item.kind}:${item.subject}:${index}`} className="text-ink2">
            <span className="font-medium">
              {tr(`skills.diagnostics.${item.kind}`, { subject: item.subject })}
            </span>
            {' — '}
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
