'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const activeId =
    selectedId && board.some((m) => m.id === selectedId) ? selectedId : (board[0]?.id ?? '');

  if (!activeId) return null;

  return (
    <Tabs value={activeId} onValueChange={setSelectedId}>
      <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
        {board.map((m) => {
          const isLive = streaming.has(m.id);
          const hasError = Boolean(errors[m.id]);
          return (
            <TabsTrigger key={m.id} value={m.id} className="gap-2">
              <span>{m.label}</span>
              {m.lens && (
                <Badge variant="secondary" className="px-1.5 text-[10px] tracking-wide uppercase">
                  {LENSES[m.lens].label}
                </Badge>
              )}
              {isLive && <span className="bg-primary inline-block size-2 animate-pulse rounded-full" />}
              {hasError && <span className="bg-destructive inline-block size-2 rounded-full" />}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {board.map((m) => {
        const text = responses[m.id] ?? '';
        const error = errors[m.id];
        const isStreaming = streaming.has(m.id);
        return (
          <TabsContent key={m.id} value={m.id} className="mt-3">
            {error ? (
              <pre className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2 text-xs whitespace-pre-wrap">
                {error}
              </pre>
            ) : (
              <pre className="bg-muted min-h-[12rem] rounded-md border px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {text || (isStreaming ? '...' : 'No response yet.')}
              </pre>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
