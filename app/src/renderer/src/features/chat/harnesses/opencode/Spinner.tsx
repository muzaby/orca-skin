/*
Adapted from anomalyco/opencode v1.19.0, packages/ui/src/components/spinner.tsx.
MIT License

Copyright (c) 2025 opencode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const OUTER = new Set([1, 2, 4, 7, 8, 11, 13, 14])
const CORNERS = new Set([0, 3, 12, 15])
// 원본처럼 모듈 초기화에서 한 번만 결정한다. 경과 시간 갱신이 애니메이션을 재시작하지 않는다.
const SQUARES = Array.from({ length: 16 }, (_, index) => ({
  index,
  x: (index % 4) * 4,
  y: Math.floor(index / 4) * 4,
  delay: Math.random() * 1.5,
  duration: 1 + Math.random(),
  outer: OUTER.has(index),
  corner: CORNERS.has(index)
}))

export function OpenCodeSpinner(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 15 15"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 text-oc-muted"
      data-component="opencode-spinner"
    >
      {SQUARES.map((square) => (
        <rect
          key={square.index}
          x={square.x}
          y={square.y}
          width="3"
          height="3"
          rx="1"
          className={
            square.corner
              ? 'opacity-0'
              : square.outer
                ? 'animate-oc-spinner-dim opacity-[0.15] motion-reduce:animate-none'
                : 'animate-oc-spinner-bright opacity-40 motion-reduce:animate-none'
          }
          style={
            square.corner
              ? undefined
              : {
                  animationDuration: `${square.duration}s`,
                  animationDelay: `${square.delay}s`
                }
          }
        />
      ))}
    </svg>
  )
}
