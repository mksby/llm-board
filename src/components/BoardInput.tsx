'use client';

import { useState } from 'react';

interface Props {
  disabled: boolean;
  onSubmit: (question: string) => void;
}

export function BoardInput({ disabled, onSubmit }: Props) {
  const [value, setValue] = useState('');

  const canSubmit = !disabled && value.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(value.trim());
      }}
    >
      <textarea
        className="border-board-border bg-board-surface focus:border-board-accent w-full resize-y rounded-md border px-3 py-2 text-sm focus:outline-none"
        placeholder="Ask the board a hard question..."
        rows={5}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
            e.preventDefault();
            onSubmit(value.trim());
          }
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-board-muted text-xs">Cmd/Ctrl+Enter to submit</p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-board-accent rounded-md px-4 py-1.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          Convene the board
        </button>
      </div>
    </form>
  );
}
