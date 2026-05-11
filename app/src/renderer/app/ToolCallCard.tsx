import React from 'react';
import type { ToolCall } from './state';

export interface ToolCallCardProps {
  toolCall: ToolCall;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const isCompleted = toolCall.status === 'completed';
  const isError = toolCall.status === 'error';
  const isPending = toolCall.status === 'pending';

  return (
    <div className={`rounded-lg border p-3 mb-2 ${
      isError ? 'bg-rose-50 border-rose-300' :
      isPending ? 'bg-cream-50 border-ink-300' :
      'bg-moss-50 border-moss-300'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-semibold text-sm text-ink-900 flex items-center gap-2">
            <span>{toolCall.name}</span>
            {isPending && (
              <span className="text-xs text-ink-400">
                <svg className="w-3 h-3 animate-spin inline" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4.555 5.659c0 3.08 2.981 5.58 6.697 5.58.56 0 1.103-.067 1.628-.196.206.477.451.94.722 1.38-1.063.215-2.2.33-3.35.33C4.922 12.853.5 9.864.5 6.16c0-2.213 2.209-4.165 5.18-4.87.261.49.475.97.637 1.47-.262.05-.52.13-.762.23z"></path>
                </svg>
              </span>
            )}
          </div>

          <div className="text-xs text-ink-600 mt-2 mb-2 bg-white rounded p-2 font-mono overflow-x-auto max-h-32">
            <pre>{JSON.stringify(toolCall.input, null, 2)}</pre>
          </div>

          {(isCompleted || isError) && toolCall.output && (
            <div className="text-xs text-ink-700 mt-2 bg-white rounded p-2 overflow-x-auto max-h-32">
              <div className="font-semibold text-ink-900 mb-1">
                {isError ? 'Error' : 'Result'}:
              </div>
              <div className={isError ? 'text-rose-700' : 'text-moss-700'}>
                {typeof toolCall.output === 'string'
                  ? toolCall.output
                  : JSON.stringify(toolCall.output, null, 2)
                }
              </div>
            </div>
          )}
        </div>

        {toolCall.durationMs && (
          <div className="text-xs text-ink-400 flex-shrink-0">
            {toolCall.durationMs < 1000
              ? `${toolCall.durationMs}ms`
              : `${(toolCall.durationMs / 1000).toFixed(1)}s`
            }
          </div>
        )}
      </div>
    </div>
  );
}
