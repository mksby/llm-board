'use client';

import { useState } from 'react';
import type { BoardMember } from '@/lib/board';
import { LENSES } from '@/lib/lenses';

interface Props {
  board: readonly BoardMember[];
  responses: Record<string, string>;
  streaming: Set<string>;
  errors: Record<string, string>;
}

export function StageOneTabs({ board, responses, streaming, errors }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Active tab is the user's selection if still valid, otherwise the first
  // member. Derived at render time so we never need an effect to repair it.
  const activeId =
    selectedId && board.some((m) => m.id === selectedId) ? selectedId : (board[0]?.id ?? '');

  const active = board.find((m) => m.id === activeId);
  const text = active ? (responses[active.id] ?? '') : '';
  const isStreaming = active ? streaming.has(active.id) : false;
  const error = active ? errors[active.id] : undefined;

  return (
    <section>
      <div className="border-board-border mb-3 flex gap-1 border-b">
        {board.map((m) => {
          const isActive = m.id === activeId;
          const isLive = streaming.has(m.id);
          const hasError = Boolean(errors[m.id]);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={`relative px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'text-board-text border-board-accent border-b-2'
                  : 'text-board-muted hover:text-board-text border-b-2 border-transparent'
              }`}
            >
              {m.label}
              {m.lens && (
                <span className="text-board-muted ml-1.5 text-[10px] uppercase tracking-wide">
                  {LENSES[m.lens].label}
                </span>
              )}
              {isLive && <span className="bg-board-accent ml-2 inline-block size-2 animate-pulse rounded-full" />}
              {hasError && <span className="ml-2 inline-block size-2 rounded-full bg-red-500" />}
            </button>
          );
        })}
      </div>
      {error ? (
        <pre className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs whitespace-pre-wrap text-red-200">
          {error}
        </pre>
      ) : (
        <pre className="border-board-border bg-board-surface min-h-[12rem] rounded-md border px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {text || (isStreaming ? '...' : 'No response yet.')}
        </pre>
      )}
    </section>
  );
}
