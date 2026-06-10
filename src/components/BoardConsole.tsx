'use client';

import { useCallback, useMemo, useState } from 'react';
import type { BoardMember } from '@/lib/board';
import type { ReviewPayloadT, Stage1Event } from '@/lib/types';
import { BoardInput } from './BoardInput';
import { BoardSettings } from './BoardSettings';
import { EventLog, type LogEntry, type LogLevel, type LogStage } from './EventLog';
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

// Trim long provider error messages so a single log line stays scannable.
function shortenError(message: string): string {
  // Strip "Failed after N attempts. Last error: " preamble common to AI SDK errors.
  const stripped = message.replace(/^Failed after \d+ attempts?\.\s*Last error:\s*/i, '');
  if (stripped.length <= 220) return stripped;
  return `${stripped.slice(0, 217)}…`;
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
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const chairman = useMemo(
    () => activeBoard.find((m) => m.id === chairmanId) ?? activeBoard[0]!,
    [activeBoard, chairmanId],
  );

  const busy = phase === 'stage1' || phase === 'stage2' || phase === 'stage3';

  const appendLog = useCallback(
    (entry: { stage: LogStage; level?: LogLevel; memberLabel?: string; message: string }) => {
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          timestamp: Date.now(),
          level: entry.level ?? 'info',
          stage: entry.stage,
          memberLabel: entry.memberLabel,
          message: entry.message,
        },
      ]);
    },
    [],
  );

  const labelFor = useCallback(
    (memberId: string) => activeBoard.find((m) => m.id === memberId)?.label ?? memberId,
    [activeBoard],
  );

  const runRound = useCallback(
    async (q: string) => {
      setQuestion(q);
      setResponses({});
      setStreaming(new Set(activeBoard.map((m) => m.id)));
      setErrors({});
      setPeerReview(null);
      setVerdict('');
      setGlobalError(null);
      setLogs([]);
      setPhase('stage1');

      appendLog({
        stage: 'system',
        message: `new round · ${activeBoard.length} members · chairman: ${chairman.label}`,
      });
      appendLog({
        stage: 1,
        message: `dispatching question to ${activeBoard.length} members in parallel`,
      });
      for (const m of activeBoard) {
        appendLog({
          stage: 1,
          memberLabel: m.label,
          message: m.lens ? `requested · lens: ${m.lens}` : 'requested',
        });
      }

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
            if (evt.type === 'start') {
              appendLog({ stage: 1, memberLabel: labelFor(evt.memberId), message: 'streaming…' });
            } else if (evt.type === 'retry') {
              appendLog({
                stage: 1,
                level: 'warn',
                memberLabel: labelFor(evt.memberId),
                message: `rate-limited · waiting ${Math.round(evt.waitMs / 1000)}s before attempt ${evt.attempt}/${evt.maxAttempts} · ${shortenError(evt.reason)}`,
              });
            } else if (evt.type === 'token') {
              collectedResponses[evt.memberId] = (collectedResponses[evt.memberId] ?? '') + evt.text;
              const snapshot = { ...collectedResponses };
              setResponses(snapshot);
            } else if (evt.type === 'done') {
              const chars = collectedResponses[evt.memberId]?.length ?? 0;
              appendLog({
                stage: 1,
                memberLabel: labelFor(evt.memberId),
                message: `done · ${chars} chars`,
              });
              setStreaming((prev) => {
                const next = new Set(prev);
                next.delete(evt.memberId);
                return next;
              });
            } else if (evt.type === 'error') {
              appendLog({
                stage: 1,
                level: 'error',
                memberLabel: labelFor(evt.memberId),
                message: `failed · ${shortenError(evt.error)}`,
              });
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
        const message = err instanceof Error ? err.message : String(err);
        appendLog({ stage: 1, level: 'error', message: `stage 1 aborted · ${shortenError(message)}` });
        setGlobalError(message);
        setPhase('error');
        return;
      }

      const responsesForReview = Object.fromEntries(
        Object.entries(collectedResponses).filter(([, v]) => v && v.trim().length > 0),
      );

      const respondingBoard = activeBoard.filter((m) => responsesForReview[m.id]);
      if (respondingBoard.length < 2) {
        const message = `Fewer than 2 members produced a response (${respondingBoard.length}/${activeBoard.length}) — cannot run peer review.`;
        appendLog({ stage: 'system', level: 'error', message });
        setGlobalError(message);
        setPhase('error');
        return;
      }

      if (respondingBoard.length < activeBoard.length) {
        appendLog({
          stage: 'system',
          level: 'warn',
          message: `${activeBoard.length - respondingBoard.length} of ${activeBoard.length} members failed — continuing with ${respondingBoard.length}`,
        });
      }

      // ---------------- Stage 2: anonymised peer review ----------------
      setPhase('stage2');
      appendLog({
        stage: 2,
        message: `anonymising ${respondingBoard.length} responses and dispatching to reviewers`,
      });
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
        for (const r of stage2Body.reviews) {
          appendLog({
            stage: 2,
            memberLabel: labelFor(r.reviewerId),
            message: `review returned · top: ${r.payload.strongest}, weak: ${r.payload.weakest}`,
          });
        }
        for (const f of stage2Body.failed) {
          appendLog({
            stage: 2,
            level: 'error',
            memberLabel: labelFor(f.reviewerId),
            message: `reviewer failed · ${shortenError(f.error)}`,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        appendLog({ stage: 2, level: 'error', message: `stage 2 aborted · ${shortenError(message)}` });
        setGlobalError(message);
        setPhase('error');
        return;
      }

      if (stage2Body.reviews.length === 0) {
        const message = 'All reviewers failed — cannot synthesise a verdict.';
        appendLog({ stage: 'system', level: 'error', message });
        setGlobalError(message);
        setPhase('error');
        return;
      }

      // ---------------- Stage 3: chairman synthesis (streamed) ----------------
      setPhase('stage3');
      appendLog({
        stage: 3,
        memberLabel: chairman.label,
        message: `synthesising verdict from ${respondingBoard.length} answers + ${stage2Body.reviews.length} reviews`,
      });
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
        const transcriptId = res.headers.get('X-Transcript-Id');
        if (transcriptId) {
          appendLog({
            stage: 'system',
            message: `transcript id: ${transcriptId} (saved to data/transcripts/ on round end)`,
          });
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
        appendLog({
          stage: 3,
          memberLabel: chairman.label,
          message: `verdict streamed · ${acc.length} chars`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        appendLog({ stage: 3, level: 'error', message: `stage 3 aborted · ${shortenError(message)}` });
        setGlobalError(message);
        setPhase('error');
        return;
      }

      appendLog({ stage: 'system', message: 'round complete' });
      setPhase('done');
    },
    [activeBoard, appendLog, chairman.id, chairman.label, labelFor],
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
        <div className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2 text-xs">
          {globalError}
        </div>
      )}

      {phase !== 'idle' && (
        <section>
          <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">Question</h2>
          <p className="bg-muted rounded-md border px-3 py-2 text-sm">{question}</p>
        </section>
      )}

      {logs.length > 0 && <EventLog logs={logs} />}

      {(phase === 'stage1' ||
        phase === 'stage2' ||
        phase === 'stage3' ||
        phase === 'done' ||
        phase === 'error') && (
        <section>
          <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
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
          <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
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
          <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
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
