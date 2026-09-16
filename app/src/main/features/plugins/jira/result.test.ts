import { describe, expect, it } from 'vitest'
import {
  JiraToolError,
  prepareJiraSuccessResult,
  toJiraErrorResult,
  type JiraDownloadData
} from './result'

describe('Jira agent result envelope', () => {
  it('text와 structuredContent는 같은 success envelope다', () => {
    const result = prepareJiraSuccessResult('jira_getIssue', { key: 'QA-1' })
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
    expect(result.structuredContent).toEqual({
      ok: true,
      tool: 'jira_getIssue',
      data: { key: 'QA-1' }
    })
    expect(result.isError).toBeUndefined()
  })

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [429, 'rate_limited'],
    [500, 'jira_error']
  ] as const)('HTTP %s를 %s로 안전하게 매핑한다', (status, code) => {
    const result = toJiraErrorResult(
      'jira_getIssue',
      new JiraToolError(code, `status ${status}`, status, {
        errorMessages: ['not found'],
        errors: { key: 'invalid' }
      })
    )
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
    expect(result.structuredContent).toMatchObject({ ok: false, error: { code, status } })
  })

  it('transport 오류에서 Authorization과 bearer token을 노출하지 않는다', () => {
    const result = toJiraErrorResult(
      'jira_searchIssues',
      new Error('Authorization: Bearer super-secret-token')
    )
    expect(result.content[0].text).not.toContain('super-secret-token')
    expect(result.content[0].text).toContain('[redacted]')
  })

  it('known Jira 오류에서도 cookie와 proxy authorization 값을 마스킹한다', () => {
    const result = toJiraErrorResult(
      'jira_getIssue',
      new JiraToolError(
        'jira_error',
        'Cookie: session=private-cookie\nProxy-Authorization: Basic private-proxy'
      )
    )
    expect(result.content[0].text).not.toContain('private-cookie')
    expect(result.content[0].text).not.toContain('private-proxy')
    expect(result.content[0].text.match(/\[redacted\]/g)).toHaveLength(2)
  })

  it('Jira error details 안의 인증 헤더와 cookie도 bounded redaction한다', () => {
    const result = toJiraErrorResult(
      'jira_getIssue',
      new JiraToolError('jira_error', 'request failed', 500, {
        errorMessages: ['Authorization: Bearer private-token'],
        errors: { session: 'Cookie: session=private-cookie' }
      })
    )
    expect(result.content[0].text).not.toContain('private-token')
    expect(result.content[0].text).not.toContain('private-cookie')
    expect(result.structuredContent).toMatchObject({
      error: {
        details: {
          errorMessages: ['Authorization: [redacted]'],
          errors: { session: 'Cookie: [redacted]' }
        }
      }
    })
  })

  it('download inline은 source 순서대로 budget을 배분하고 metadata를 유지한다', () => {
    const data: JiraDownloadData = {
      count: 2,
      skipped: [],
      attachments: [
        { id: '1', filename: 'a.txt', size: 20, encoding: 'text', content: 'a'.repeat(20) },
        { id: '2', filename: 'b.txt', size: 20, encoding: 'text', content: 'b'.repeat(20) }
      ]
    }
    const one = prepareJiraSuccessResult('jira_downloadAttachment', data, 270)
    const output = one.structuredContent?.data as JiraDownloadData
    expect(output.attachments[0].content).toBe('a'.repeat(20))
    expect(output.attachments[1]).toMatchObject({
      id: '2',
      filename: 'b.txt',
      size: 20,
      contentOmittedReason: 'tool_output_limit'
    })
    expect(Buffer.byteLength(JSON.stringify(one.structuredContent))).toBeLessThanOrEqual(270)
  })

  it('필수 metadata만으로 output 상한을 넘으면 success를 만들지 않는다', () => {
    expect(() =>
      prepareJiraSuccessResult(
        'jira_downloadAttachment',
        {
          count: 1,
          skipped: [],
          attachments: [{ filename: 'x'.repeat(500), size: 1 }]
        },
        100
      )
    ).toThrow('tool_output_too_large')
  })
})
