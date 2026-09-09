// Main 수신 구간의 표시 경계. ended는 수신 마감이며 사용자 작업의 성공 판정이 아니다.
export type ResponseBoundary =
  | { phase: 'begin'; id: string }
  | { phase: 'end'; id: string; outcome: 'ended' | 'aborted' | 'failed' | 'unknown' }

export interface ResponseBoundaryPart {
  type: 'response_boundary'
  boundary: ResponseBoundary
}

// live reducer와 DB writer가 같은 part 형상을 사용한다.
export function responseBoundaryPart(boundary: ResponseBoundary): ResponseBoundaryPart {
  return { type: 'response_boundary', boundary }
}
