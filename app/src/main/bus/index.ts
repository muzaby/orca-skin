// TypedBus — main 내부 단일 이벤트 버스(아키텍처 스펙 §4.2 "단일 파이프라인"). 어댑터가 방출한
// NormalizedEvent 를 한 번 emit 하면 등록된 소비자(usage 집계·history 영속·renderer 중계)가
// 순서대로 소비한다. 소비자는 서로를 모른다 — 버스 구독으로만 존재한다.
//
// 계약(비타협):
//  - **동기·등록순 실행**. emit 은 등록 순서대로 리스너를 *동기* 호출하고 전부 끝난 뒤 반환한다.
//    Node EventEmitter 와 같은 의미론이되 'error' 이벤트 특례·미타입 표면을 피해 자체 구현한다.
//    → 소비 순서에 의존하는 불변식(usage 가 history 의 reset *전* 에 messageId 를 읽는다 등)을
//    등록 순서 한 곳(bootstrap)에서 고정할 수 있다.
//  - **async 리스너 금지**. 리스너는 동기 완료해야 한다(fire-and-forget 이 필요하면 리스너 내부에서
//    `void fn()`). 순서 보장의 전제다.
//  - **critical 격리 정책**. `critical:true` 리스너의 throw 는 그대로 전파한다(뒤 리스너 실행 중단
//    — persist/usage 실패 = 턴 실패라는 현행 의미 보존). 기본(`critical:false`)은 try/catch 로
//    격리하고 로그만 남긴 뒤 다음 리스너를 계속 실행한다(중계·제목 실패가 파이프라인을 죽이지 않게).
//
// L0/L1: main 하위 어떤 모듈도 import 하지 않는 순수 유틸(이벤트 맵 타입은 소비 측이 주입).

type Listener<P> = { fn: (payload: P) => void; critical: boolean }

// M = 이벤트 맵(예: OrcaBusEvents) — 키→페이로드 타입. 인터페이스도 그대로 쓸 수 있게 index
// signature(Record) 제약을 두지 않고 keyof M 로 타입을 유도한다.
export class TypedBus<M> {
  private readonly listeners = new Map<keyof M, Listener<unknown>[]>()

  // 구독 등록. 반환값은 해제 함수(테스트·수명주기 정리용).
  on<K extends keyof M>(
    key: K,
    fn: (payload: M[K]) => void,
    opts?: { critical?: boolean }
  ): () => void {
    const entry: Listener<unknown> = {
      fn: fn as (payload: unknown) => void,
      critical: opts?.critical ?? false
    }
    const list = this.listeners.get(key) ?? []
    list.push(entry)
    this.listeners.set(key, list)
    return () => {
      const cur = this.listeners.get(key)
      if (!cur) return
      const i = cur.indexOf(entry)
      if (i >= 0) cur.splice(i, 1)
    }
  }

  // 동기·등록순 방출. 스냅샷([...list])을 순회해 리스너가 emit 중 구독을 바꿔도 이번 방출은 안정적.
  emit<K extends keyof M>(key: K, payload: M[K]): void {
    const list = this.listeners.get(key)
    if (!list || list.length === 0) return
    for (const { fn, critical } of [...list]) {
      if (critical) {
        fn(payload)
      } else {
        try {
          fn(payload)
        } catch (err) {
          console.error(`[bus] '${String(key)}' 리스너 오류(격리):`, err)
        }
      }
    }
  }
}
