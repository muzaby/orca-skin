export function WinControls(): React.JSX.Element {
  const base =
    'grid h-[22px] w-[28px] place-items-center rounded border-0 bg-transparent text-ink2 [-webkit-app-region:no-drag] hover:bg-black/[0.06]'
  return (
    <div className="ml-auto flex gap-1.5 [-webkit-app-region:no-drag]">
      <button className={base} aria-label="Minimize">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <button className={base} aria-label="Maximize">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect
            x="1.5"
            y="1.5"
            width="7"
            height="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
      <button className={`${base} hover:!bg-[#e44a3a] hover:!text-white`} aria-label="Close">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            d="M2 2l6 6M8 2l-6 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
