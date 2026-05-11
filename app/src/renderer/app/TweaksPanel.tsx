import React, { useState } from 'react';

export function TweaksPanel() {
  const [open, setOpen] = useState(false);

  const handleThemeClick = () => {
    if (window.orca) {
      void window.orca.settings.set('theme', 'dark');
    }
  };

  const handleDensityClick = (density: 'compact' | 'normal' | 'spacious') => {
    if (window.orca) {
      void window.orca.settings.set('density', density);
    }
  };

  const handleSidebarToggle = () => {
    if (window.orca) {
      void window.orca.settings.set('sidebarVisible', true);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-rust-400 text-white hover:bg-rust-500 flex items-center justify-center shadow-lg"
        title="Open tweaks panel"
      >
        ⚙️
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-cream-50 border border-ink-300 rounded-lg p-4 w-56 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-ink-900">Tweaks</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-ink-500 hover:text-ink-900 font-bold"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Theme Control */}
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-2">
            Theme
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleThemeClick}
              className="flex-1 px-3 py-2 bg-ink-100 text-ink-900 rounded text-xs hover:bg-ink-200 transition"
            >
              ☀️ Light
            </button>
            <button
              onClick={() => {
                if (window.orca) {
                  void window.orca.settings.set('theme', 'dark');
                }
              }}
              className="flex-1 px-3 py-2 bg-ink-100 text-ink-900 rounded text-xs hover:bg-ink-200 transition"
            >
              🌙 Dark
            </button>
          </div>
        </div>

        {/* Density Control */}
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-2">
            Density
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleDensityClick('compact')}
              className="flex-1 px-2 py-2 bg-ink-100 text-ink-900 rounded text-xs hover:bg-ink-200 transition"
            >
              Compact
            </button>
            <button
              onClick={() => handleDensityClick('normal')}
              className="flex-1 px-2 py-2 bg-ink-100 text-ink-900 rounded text-xs hover:bg-ink-200 transition"
            >
              Normal
            </button>
            <button
              onClick={() => handleDensityClick('spacious')}
              className="flex-1 px-2 py-2 bg-ink-100 text-ink-900 rounded text-xs hover:bg-ink-200 transition"
            >
              Spacious
            </button>
          </div>
        </div>

        {/* Sidebar Control */}
        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-2">
            Sidebar
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSidebarToggle}
              className="flex-1 px-3 py-2 bg-ink-100 text-ink-900 rounded text-xs hover:bg-ink-200 transition"
            >
              ◀️ Show
            </button>
            <button
              onClick={() => {
                if (window.orca) {
                  void window.orca.settings.set('sidebarVisible', false);
                }
              }}
              className="flex-1 px-3 py-2 bg-ink-100 text-ink-900 rounded text-xs hover:bg-ink-200 transition"
            >
              ▶️ Hide
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-500 mt-4 border-t border-ink-300 pt-2">
        Phase 2: CSS variables, themes
      </p>
    </div>
  );
}
