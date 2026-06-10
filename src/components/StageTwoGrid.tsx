'use client';

import type { BoardMember } from '@/lib/board';
import type { ReviewPayloadT } from '@/lib/types';

interface Props {
  board: readonly BoardMember[];
  reveal: Record<string, string>;
  reviews: Array<{ reviewerId: string; payload: ReviewPayloadT }>;
  failed: Array<{ reviewerId: string; error: string }>;
}

function labelFor(board: readonly BoardMember[], id: string): string {
  return board.find((m) => m.id === id)?.label ?? id;
}

export function StageTwoGrid({ board, reveal, reviews, failed }: Props) {
  const letters = Object.keys(reveal).sort();

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide uppercase opacity-80">
          Anonymisation reveal
        </h3>
        <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4">
          {letters.map((letter) => (
            <li
              key={letter}
              className="border-board-border bg-board-surface rounded-md border px-2 py-1.5"
            >
              <span className="font-mono font-semibold">{letter}</span>
              <span className="text-board-muted"> · {labelFor(board, reveal[letter] ?? '')}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide uppercase opacity-80">
          Peer reviews
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reviews.map((r) => {
            const rankings = [...r.payload.rankings].sort((a, b) => a.rank - b.rank);
            return (
              <article
                key={r.reviewerId}
                className="border-board-border bg-board-surface rounded-md border p-3 text-xs"
              >
                <header className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">{labelFor(board, r.reviewerId)}</span>
                  <span className="text-board-muted">reviewer</span>
                </header>
                <ol className="mb-3 space-y-0.5">
                  {rankings.map((row) => (
                    <li key={row.key} className="font-mono">
                      <span className="text-board-muted mr-1">#{row.rank}</span>
                      {row.key} · {labelFor(board, reveal[row.key] ?? '')}
                    </li>
                  ))}
                </ol>
                <dl className="space-y-1">
                  <div>
                    <dt className="text-board-muted">Strongest ({r.payload.strongest})</dt>
                    <dd>{r.payload.strongestReason}</dd>
                  </div>
                  <div>
                    <dt className="text-board-muted">Weakest ({r.payload.weakest})</dt>
                    <dd>{r.payload.weakestReason}</dd>
                  </div>
                  <div>
                    <dt className="text-board-muted">What all missed</dt>
                    <dd>{r.payload.whatAllMissed}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
        {failed.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            <strong>Failed reviewers:</strong>{' '}
            {failed.map((f) => `${labelFor(board, f.reviewerId)} (${f.error})`).join('; ')}
          </div>
        )}
      </div>
    </section>
  );
}
