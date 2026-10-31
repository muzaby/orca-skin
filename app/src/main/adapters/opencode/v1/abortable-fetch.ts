/** Dispose a late response body when cancellation wins over a transport that still resolves. */
export async function abortableFetch(
  fetchImpl: typeof fetch,
  request: Request,
  signal: AbortSignal
): Promise<Response> {
  signal.throwIfAborted()
  const response = await fetchImpl(new Request(request, { signal }))
  if (signal.aborted) {
    await response.body?.cancel().catch(() => undefined)
    signal.throwIfAborted()
  }
  return response
}
