import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, children, ...props }: any) {
          if (inline) {
            return (
              <code className="font-mono text-xs bg-cream-50 px-1.5 py-0.5 rounded" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className="font-mono text-xs" {...props}>
              {children}
            </code>
          );
        },
        pre({ children, ...props }: any) {
          return (
            <pre className="bg-cream-50 border border-ink-300 rounded-lg p-3 overflow-x-auto my-2" {...props}>
              {children}
            </pre>
          );
        },
        p({ children, ...props }: any) {
          return (
            <p className="my-2" {...props}>
              {children}
            </p>
          );
        },
        h1({ children, ...props }: any) {
          return (
            <h1 className="font-serif text-lg font-semibold my-2 mt-3" {...props}>
              {children}
            </h1>
          );
        },
        h2({ children, ...props }: any) {
          return (
            <h2 className="font-serif text-base font-semibold my-2 mt-3" {...props}>
              {children}
            </h2>
          );
        },
        h3({ children, ...props }: any) {
          return (
            <h3 className="font-serif text-md font-semibold my-2" {...props}>
              {children}
            </h3>
          );
        },
        ul({ children, ...props }: any) {
          return (
            <ul className="list-disc list-inside pl-2 my-2" {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }: any) {
          return (
            <ol className="list-decimal list-inside pl-2 my-2" {...props}>
              {children}
            </ol>
          );
        },
        table({ children, ...props }: any) {
          return (
            <table className="w-full border-collapse my-2" {...props}>
              {children}
            </table>
          );
        },
        th({ children, ...props }: any) {
          return (
            <th className="border border-ink-300 px-3 py-2 font-semibold bg-cream-50 text-xs" {...props}>
              {children}
            </th>
          );
        },
        td({ children, ...props }: any) {
          return (
            <td className="border border-ink-300 px-3 py-2 text-xs" {...props}>
              {children}
            </td>
          );
        },
        a({ href, children, ...props }: any) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rust-400 no-underline hover:underline"
              {...props}
            >
              {children}
            </a>
          );
        },
      }}
      className="markdown"
    >
      {content}
    </Markdown>
  );
}
