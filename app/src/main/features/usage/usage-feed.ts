// usage 표본 구독 허브 (0176).
//
// 하나의 connector 호출 결과를 **여러 usage provider 가 함께** 본다 — 그것이 이 파일이
// 존재하는 이유다. provider 마다 따로 부르면 같은 사내 API 를 provider 수만큼 두드리게 된다.
//
// **순수 모듈이다** — 네트워크·DB·electron 을 모른다. 표본을 만드는 쪽(`ExternalUsageService`)이
// publish 하고, 해석하는 쪽(모듈의 `map`)이 subscribe 한다.

import type { UsageSample } from '../../contracts/usage-source'

interface UsageSampleSelector {
  // 미지정 = 모든 source. 모듈이 `subscription.sourceId` 를 안 적은 경우다.
  sourceId?: string
  // 미지정 = 모든 operation.
  operation?: string
}

type UsageSampleListener = (sample: UsageSample) => void

type UsageFeedUnsubscribe = () => void

interface Registration {
  selector: UsageSampleSelector
  listener: UsageSampleListener
}

export function matchesSelector(selector: UsageSampleSelector, sample: UsageSample): boolean {
  if (selector.sourceId !== undefined && selector.sourceId !== sample.sourceId) return false
  if (selector.operation !== undefined && selector.operation !== sample.operation) return false
  return true
}

export class UsageFeed {
  private readonly registrations = new Set<Registration>()

  constructor(
    private readonly onListenerError: (
      message: string,
      meta?: Record<string, unknown>
    ) => void = () => {}
  ) {}

  subscribe(selector: UsageSampleSelector, listener: UsageSampleListener): UsageFeedUnsubscribe {
    const registration: Registration = { selector, listener }
    this.registrations.add(registration)
    return () => {
      this.registrations.delete(registration)
    }
  }

  // 전달한 구독자 수를 돌려준다. **구독자 예외는 격리한다** — 매핑 하나가 던져도 같은 표본을
  // 기다리는 다른 provider 의 사용량이 함께 멈추면 안 된다.
  publish(sample: UsageSample): number {
    let delivered = 0
    for (const registration of [...this.registrations]) {
      if (!matchesSelector(registration.selector, sample)) continue
      delivered += 1
      try {
        registration.listener(sample)
      } catch (err) {
        this.onListenerError('usage sample listener threw', {
          sourceId: sample.sourceId,
          operation: sample.operation,
          message: String(err)
        })
      }
    }
    return delivered
  }

  get size(): number {
    return this.registrations.size
  }
}
