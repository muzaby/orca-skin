export class AuthPolicyError extends Error {
  constructor(
    readonly reason: string,
    detail: string
  ) {
    super(`요청이 거부됐습니다 (${reason}: ${detail})`)
    this.name = 'AuthPolicyError'
  }
}
