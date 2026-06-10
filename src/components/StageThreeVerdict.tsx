'use client';

import type { BoardMember } from '@/lib/board';

interface Props {
  chairman: BoardMember;
  verdict: string;
  streaming: boolean;
}

export function StageThreeVerdict({ chairman, verdict, streaming }: Props) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-wide uppercase opacity-80">
          Verdict <span className="text-board-muted">· {chairman.label}</span>
        </h3>
        {streaming && (
          <span className="text-board-muted flex items-center gap-1 text-xs">
            <span className="bg-board-accent inline-block size-2 animate-pulse rounded-full" />
            streaming
          </span>
        )}
      </header>
      <article className="border-board-border bg-board-surface min-h-[16rem] rounded-md border px-4 py-3 leading-relaxed">
        <pre className="font-sans text-sm whitespace-pre-wrap">
          {verdict || (streaming ? 'Waiting on the chairman...' : 'No verdict yet.')}
        </pre>
      </article>
    </section>
  );
}
