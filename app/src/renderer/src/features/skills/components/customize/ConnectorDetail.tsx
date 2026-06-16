import { Icon } from '../../../../shared/ui/Icon'
import { Dot } from '../../../../shared/ui/Status'
import type { ConnectorItem } from './data'

// 맞춤설정 우측 — 커넥터 상세(첨부 3·4). 아이콘 + 이름 + 연결/연결 해제 버튼,
// 전송 방식·상태, 능력 불릿 리스트(기존 권한 패널 내용 흡수).
export function ConnectorDetail({
  connector,
  onToggleConnection
}: {
  connector: ConnectorItem
  onToggleConnection: () => void
}): React.JSX.Element {
  const connected = connector.group !== 'disconnected'

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-r4 bg-cream-50 text-ink2">
          <Icon name={connector.icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 font-serif text-[20px] font-semibold text-ink">{connector.name}</h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink3">
            <span className="font-mono uppercase">{connector.transport}</span>
            <span>·</span>
            <Dot tone={connected ? 'green' : 'slate'} />
            <span>{connected ? '연결됨' : '연결되지 않음'}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleConnection}
          className={`ml-auto cursor-pointer rounded-r4 border px-3.5 py-1.5 text-[12.5px] font-medium ${
            connected
              ? 'border-border bg-panel text-ink2 hover:bg-fill-uncontained-hover'
              : 'border-0 bg-rust text-white hover:bg-fill-primary-hover'
          }`}
        >
          {connected ? '연결 해제' : '연결'}
        </button>
      </div>

      <p className="mt-4 text-[13.5px] leading-[1.65] text-ink2">{connector.desc}</p>

      <ul className="mt-4 space-y-2.5">
        {connector.bullets.map((b, i) => {
          const dash = b.indexOf('—')
          const head = dash > 0 ? b.slice(0, dash).trim() : ''
          const rest = dash > 0 ? b.slice(dash + 1).trim() : b
          return (
            <li key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.6]">
              <span className="mt-1.5 flex-none">
                <Dot tone="green" />
              </span>
              <span className="text-ink2">
                {head !== '' && <span className="font-medium text-ink">{head} — </span>}
                {rest}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
