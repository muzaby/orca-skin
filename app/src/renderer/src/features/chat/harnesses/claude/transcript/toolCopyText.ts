// 도구 카드 헤더 복사 버튼의 복사 대상(도구별) — 카드는 클릭 때 이 함수를 부른다(0325 D-013 · EP-7 ①).
// 카드 모듈 밖에 두어 테스트가 호출을 센다(같은 모듈 안 호출은 spy 가 보지 못한다).

import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

// result.output 을 문자열로.
function resultOutput(call: ToolCall): string {
  const o = call.result?.output
  return o == null ? '' : typeof o === 'string' ? o : stringify(o)
}

// 헤더 복사 버튼의 복사 대상(도구별).
export function copyText(call: ToolCall): string {
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
