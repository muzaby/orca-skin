// 도구 input 을 1~2줄로 요약. Bash 는 command, Write/Edit 는 file_path 를 우선 노출하고,
// 그 외는 JSON 직렬화 후 truncate. 렌더링 전용이라 누락 필드는 조용히 무시.
export function summarizeToolInput(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>
    if (typeof o.command === 'string') return o.command
    if (typeof o.file_path === 'string') return o.file_path
    if (typeof o.path === 'string') return o.path
  }
  try {
    return JSON.stringify(input)
  } catch {
    return String(input)
  }
}

// 도구 input 의 부가 설명(있으면). Bash 등은 `description` 으로 의도를 전달한다 —
// 본문에 요약(summarizeToolInput) 위 보조 줄로 노출. 비문자열/공백은 무시.
export function toolDescription(input: unknown): string | null {
  if (input && typeof input === 'object') {
    const d = (input as Record<string, unknown>).description
    if (typeof d === 'string' && d.trim() !== '') return d.trim()
  }
  return null
}
