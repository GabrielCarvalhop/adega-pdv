import { useEffect } from 'react';

export interface Shortcut {
  key: string;
  handler: () => void;
  /** Se true, o atalho dispara mesmo com foco em um input de texto. */
  allowInInput?: boolean;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const match = shortcuts.find((s) => s.key.toLowerCase() === e.key.toLowerCase());
      if (!match) return;
      if (isTypingTarget(e.target) && !match.allowInInput) return;
      e.preventDefault();
      match.handler();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);
}
