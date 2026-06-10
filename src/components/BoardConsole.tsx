'use client';

import { useCallback, useMemo, useState } from 'react';
import type { BoardMember } from '@/lib/board';
import type { ReviewPayloadT, Stage1Event } from '@/lib/types';
import { BoardInput } from './BoardInput';
import { BoardSettings } from './BoardSettings';
import { StageOneTabs } from './StageOneTabs';
import { StageThreeVerdict } from './StageThreeVerdict';
import { StageTwoGrid } from './StageTwoGrid';

type Phase = 'idle' | 'stage1' | 'stage2' | 'stage3' | 'done' | 'error';

interface Props {
  initialBoard: readonly BoardMember[];
  initialChairmanId: string;
}

interface PeerReviewState {
  reveal: Record<string, string>;
  reviews: Array<{ reviewerId: string; payload: ReviewPayloadT }>;
  failed: Array<{ reviewerId: string; error: string }>;
}

export function BoardConsole({ initialBoard, initialChairmanId }: Props) {
  const [activeBoard, setActiveBoard] = useState<readonly BoardMember[]>(initialBoard);
  const [chairmanId, setChairmanId] = useState<string>(initialChairmanId);
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [streaming, setStreaming] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [peerReview, setPeerReview] = useState<PeerReviewState | null>(null);
  const [verdict, setVerdict] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const chairman = useMemo(
    () => activeBoard.find((m) => m.id === chairmanId) ?? activeBoard[0]!,
    [activeBoard, chairmanId],
  );

  const busy = phase === 'stage1' || phase === 'stage2' || phase === 'stage3';

  const runRound = useCallback(
    async (q: string) => {
      setQuestion(q);
      setResponses({});
      setStreaming(new Set(activeBoard.map((m) => m.id)));
      setErrors({});
      setPeerReview(null);
      setVerdict('');
      setGlobalError(null);
      setPhase('stage1');

      // ---------------- Stage 1: parallel streaming answers ----------------
      const collectedResponses: Record<string, string> = {};
      try {
        const res = await fetch('/api/stage1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, board: activeBoard }),
        });
        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => '');
          throw new Error(`stage 1 failed (${res.status}): ${body}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const evt = JSON.parse(trimmed) as Stage1Event;
            if (evt.type === 'token') {
              collectedResponses[evt.memberId] = (collectedResponses[evt.memberId] ?? '') + evt.text;
              const snapshot = { ...collectedResponses };
              setResponses(snapshot);
            } else if (evt.type === 'done') {
              setStreaming((prev) => {
                const next = new Set(prev);
                next.delete(evt.memberId);
                return next;
              });
            } else if (evt.type === 'error') {
              setErrors((prev) => ({ ...prev, [evt.memberId]: evt.error }));
              setStreaming((prev) => {
                const next = new Set(prev);
                next.delete(evt.memberId);
                return next;
              });
            }
          }
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        return;
      }

      const responsesForReview = Object.fromEntries(
        Object.entries(collectedResponses).filter(([, v]) => v && v.trim().length > 0),
      );

      const respondingBoard = activeBoard.filter((m) => responsesForReview[m.id]);
      if (respondingBoard.length < 2) {
        setGlobalError('Fewer than 2 members produced a response — cannot run peer review.');
        setPhase('error');
        return;
      }

      // ---------------- Stage 2: anonymised peer review ----------------
      setPhase('stage2');
      let stage2Body: PeerReviewState;
      try {
        const res = await fetch('/api/stage2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q,
            board: respondingBoard,
            responses: responsesForReview,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`stage 2 failed (${res.status}): ${body}`);
        }
        stage2Body = (await res.json()) as PeerReviewState;
        setPeerReview(stage2Body);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        return;
      }

      if (stage2Body.reviews.length === 0) {
        setGlobalError('All reviewers failed — cannot synthesise a verdict.');
        setPhase('error');
        return;
      }

      // ---------------- Stage 3: chairman synthesis (streamed) ----------------
      setPhase('stage3');
      try {
        const res = await fetch('/api/stage3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q,
            board: respondingBoard,
            chairmanId: chairman.id,
            responses: responsesForReview,
            reviews: stage2Body.reviews,
            reveal: stage2Body.reveal,
          }),
        });
        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => '');
          throw new Error(`stage 3 failed (${res.status}): ${body}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setVerdict(acc);
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        return;
      }

      setPhase('done');
    },
    [activeBoard, chairman.id],
  );

  return (
    <div className="flex flex-col gap-6">
      <BoardSettings
        fullRoster={initialBoard}
        active={activeBoard}
        chairmanId={chairmanId}
        disabled={busy}
        onActiveChange={(next) => {
          setActiveBoard(next);
          if (!next.some((m) => m.id === chairmanId) && next[0]) {
            setChairmanId(next[0].id);
          }
        }}
        onChairmanChange={setChairmanId}
      />

      <BoardInput disabled={busy} onSubmit={runRound} />

      {globalError && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {globalError}
        </div>
      )}

      {phase !== 'idle' && (
        <section>
          <h2 className="text-board-muted mb-2 text-xs tracking-widest uppercase">Question</h2>
          <p className="border-board-border bg-board-surface rounded-md border px-3 py-2 text-sm">
            {question}
          </p>
        </section>
      )}

      {(phase === 'stage1' ||
        phase === 'stage2' ||
        phase === 'stage3' ||
        phase === 'done' ||
        phase === 'error') && (
        <section>
          <h2 className="text-board-muted mb-2 text-xs tracking-widest uppercase">
            Stage 1 · Independent answers
          </h2>
          <StageOneTabs
            board={activeBoard}
            responses={responses}
            streaming={streaming}
            errors={errors}
          />
        </section>
      )}

      {(phase === 'stage2' || phase === 'stage3' || phase === 'done') && peerReview && (
        <section>
          <h2 className="text-board-muted mb-2 text-xs tracking-widest uppercase">
            Stage 2 · Peer review {phase === 'stage2' && '(running...)'}
          </h2>
          <StageTwoGrid
            board={activeBoard}
            reveal={peerReview.reveal}
            reviews={peerReview.reviews}
            failed={peerReview.failed}
          />
        </section>
      )}

      {(phase === 'stage3' || phase === 'done') && (
        <section>
          <h2 className="text-board-muted mb-2 text-xs tracking-widest uppercase">
            Stage 3 · Chairman synthesis
          </h2>
          <StageThreeVerdict
            chairman={chairman}
            verdict={verdict}
            streaming={phase === 'stage3'}
          />
        </section>
      )}
    </div>
  );
}
