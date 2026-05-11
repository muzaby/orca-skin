import React, { useEffect, useState } from 'react';

export interface ErrorToastProps {
  message: string | null;
  onDismiss?: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  const [visible, setVisible] = useState(!!message);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 4000);

    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!visible || !message) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-rose-400 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm text-sm animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between gap-3">
        <span>{message}</span>
        <button
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          className="flex-shrink-0 text-white hover:text-rose-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
