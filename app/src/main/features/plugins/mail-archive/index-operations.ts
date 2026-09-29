import type { MailArchiveStore, MailArchiveRevisionRef } from './store'
import type { NormalizedArchiveMail } from './types'

/**
 * index utility process가 노출하는 연산 전부. 워커 entry와 테스트가 같은 구현을 쓰고, main 쪽
 * RPC 타입은 이 객체에서 파생한다 — 연산을 손으로 세 번 적지 않는다.
 */
// 반환 타입을 손으로 적지 않는다 — 이 객체가 RPC 계약의 정본이다.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createIndexOperations(openStore: () => MailArchiveStore) {
  let store: MailArchiveStore | undefined
  const current = (): MailArchiveStore => (store ??= openStore())
  // 취소·제거된 가져오기의 늦은 batch·검증이 commit되지 않게 하는 경계.
  const activeEpochs = new Set<string>()
  const assertEpoch = (epoch: string): void => {
    if (!activeEpochs.has(epoch)) throw new Error('mail_import_epoch_revoked')
  }

  return {
    openEpoch: (epoch: string): void => void activeEpochs.add(epoch),
    revokeEpoch: (epoch: string): void => void activeEpochs.delete(epoch),
    beginRevision: (input: Parameters<MailArchiveStore['beginRevision']>[0]) =>
      current().beginRevision(input),
    upsertBatch: ({
      epoch,
      ...batch
    }: MailArchiveRevisionRef & { epoch: string; mails: readonly NormalizedArchiveMail[] }) => {
      assertEpoch(epoch)
      return current().upsertBatch(batch)
    },
    verifyRevision: ({
      epoch,
      ...input
    }: MailArchiveRevisionRef & { epoch: string; fingerprint: string }): void => {
      assertEpoch(epoch)
      current().verifyRevision(input)
    },
    abortRevision: (input: MailArchiveRevisionRef): void => current().abortRevision(input),
    refreshRelations: (): void => current().refreshRelations(),
    search: (request: Parameters<MailArchiveStore['search']>[0]) => current().search(request),
    get: (id: string) => current().get(id),
    thread: (request: Parameters<MailArchiveStore['thread']>[0]) => current().thread(request),
    attachmentLocation: (id: string) => current().attachmentLocation(id),
    sourcePathInUse: (path: string) => current().sourcePathInUse(path),
    sources: () => current().sources(),
    removeSource: (id: string) => current().removeSource(id),
    stats: () => current().stats(),
    close: (): void => {
      store?.close()
      store = undefined
    }
  }
}

export type IndexOperations = ReturnType<typeof createIndexOperations>
export type IndexOperationName = keyof IndexOperations

/** main에서 본 index: 같은 연산의 비동기판. */
export type MailArchiveIndex = {
  [K in IndexOperationName]: (
    ...args: Parameters<IndexOperations[K]>
  ) => Promise<Awaited<ReturnType<IndexOperations[K]>>>
}

/** 프로세스 경계 없이 같은 연산을 쓰는 index (테스트용). */
export function inProcessIndex(operations: IndexOperations): MailArchiveIndex {
  return Object.fromEntries(
    Object.entries(operations).map(([name, operation]) => [
      name,
      async (payload?: unknown) => (operation as (value?: unknown) => unknown)(payload)
    ])
  ) as MailArchiveIndex
}
