'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BoardMember } from '@/lib/board';

interface Props {
  chairman: BoardMember;
  verdict: string;
  streaming: boolean;
}

export function StageThreeVerdict({ chairman, verdict, streaming }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm tracking-wide uppercase">
          Verdict
          <span className="text-muted-foreground ml-2 text-xs font-normal normal-case tracking-normal">
            · {chairman.label}
          </span>
        </CardTitle>
        {streaming && (
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span className="bg-primary inline-block size-2 animate-pulse rounded-full" />
            streaming
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <pre className="min-h-[16rem] font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {verdict || (streaming ? 'Waiting on the chairman...' : 'No verdict yet.')}
        </pre>
      </CardContent>
    </Card>
  );
}
