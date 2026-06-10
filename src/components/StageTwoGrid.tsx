'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm tracking-wide uppercase">Anonymisation reveal</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4">
            {letters.map((letter) => (
              <li key={letter} className="bg-muted rounded-md border px-2 py-1.5">
                <span className="font-mono font-semibold">{letter}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {labelFor(board, reveal[letter] ?? '')}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {reviews.map((r) => {
          const rankings = [...r.payload.rankings].sort((a, b) => a.rank - b.rank);
          return (
            <Card key={r.reviewerId}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">{labelFor(board, r.reviewerId)}</CardTitle>
                <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                  reviewer
                </Badge>
              </CardHeader>
              <CardContent className="text-xs">
                <ol className="mb-3 space-y-0.5 font-mono">
                  {rankings.map((row) => (
                    <li key={row.key}>
                      <span className="text-muted-foreground mr-1">#{row.rank}</span>
                      {row.key} · {labelFor(board, reveal[row.key] ?? '')}
                    </li>
                  ))}
                </ol>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-muted-foreground">Strongest ({r.payload.strongest})</dt>
                    <dd>{r.payload.strongestReason}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Weakest ({r.payload.weakest})</dt>
                    <dd>{r.payload.weakestReason}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">What all missed</dt>
                    <dd>{r.payload.whatAllMissed}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {failed.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="text-destructive pt-4 text-xs">
            <strong>Failed reviewers: </strong>
            {failed.map((f) => `${labelFor(board, f.reviewerId)} (${f.error})`).join('; ')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
