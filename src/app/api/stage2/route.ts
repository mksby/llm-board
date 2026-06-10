import { generateObject } from 'ai';
import { z } from 'zod';
import { anonymize } from '@/lib/anonymize';
import { modelFor } from '@/lib/openrouter';
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from '@/lib/prompts/reviewer';
import {
  computeRetryWait,
  extractErrorMessage,
  getRetryAfterMs,
  isRetryableError,
  RETRY_POLICY,
} from '@/lib/retry-after';
import { Semaphore } from '@/lib/semaphore';
import { Stage2Request, ReviewPayload, type ReviewPayloadT } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const REVIEW_SCHEMA = z.object({
  rankings: z
    .array(
      z.object({
        key: z.string().length(1).describe('The letter (A, B, C, ...) of the response being ranked'),
        rank: z
          .number()
          .int()
          .min(1)
          .describe('1 = best, 2 = next, ..., n = worst. Every response must appear exactly once.'),
      }),
    )
    .min(1),
  strongest: z.string().length(1).describe('Letter of the strongest response'),
  strongestReason: z.string().min(1),
  weakest: z.string().length(1).describe('Letter of the response with the biggest blind spot'),
  weakestReason: z.string().min(1),
  whatAllMissed: z
    .string()
    .min(1)
    .describe('A point every response failed to address that the board should consider'),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Stage2Request.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { question, board, responses } = parsed.data;

  const missing = board.filter((m) => !responses[m.id]);
  if (missing.length > 0) {
    return Response.json(
      {
        error: `Missing response(s) for: ${missing.map((m) => m.id).join(', ')}`,
      },
      { status: 400 },
    );
  }

  const items = board.map((m) => ({ id: m.id, value: responses[m.id]! }));
  const { shuffled, reveal } = anonymize(items);
  const anonymized = shuffled.map((s) => ({ key: s.key, text: s.value }));

  const sema = new Semaphore(RETRY_POLICY.maxConcurrentRequests);

  const reviews = await Promise.all(
    board.map(async (member, idx) => {
      // Stagger + concurrency cap — same shape as stage 1, prevents the
      // reviewer fan-out from re-bursting at upstreams right after answers
      // finish.
      if (idx > 0) {
        await new Promise((r) => setTimeout(r, idx * RETRY_POLICY.staggerBetweenMembersMs));
      }

      const release = await sema.acquire();
      try {
        let lastErr: unknown;
        let totalWaitMs = 0;
        for (let attempt = 1; attempt <= RETRY_POLICY.maxAttempts; attempt++) {
          try {
            const result = await generateObject({
              model: modelFor(member.model),
              schema: REVIEW_SCHEMA,
              system: buildReviewerSystemPrompt(),
              prompt: buildReviewerUserPrompt({ question, anonymized }),
              maxRetries: 0,
            });
            return { reviewerId: member.id, payload: result.object as ReviewPayloadT };
          } catch (err) {
            lastErr = err;
            if (!isRetryableError(err) || attempt >= RETRY_POLICY.maxAttempts) break;
            const waitMs = computeRetryWait(getRetryAfterMs(err), attempt);
            if (totalWaitMs + waitMs > RETRY_POLICY.totalCapMs) break;
            totalWaitMs += waitMs;
            await new Promise((r) => setTimeout(r, waitMs));
          }
        }
        // One reviewer failing should not kill the round. The chairman synthesises
        // from whoever responded.
        return { reviewerId: member.id, error: extractErrorMessage(lastErr) };
      } finally {
        release();
      }
    }),
  );

  const successfulReviews = reviews.filter(
    (r): r is { reviewerId: string; payload: ReviewPayloadT } => 'payload' in r,
  );

  const failed = reviews.filter((r) => 'error' in r);

  // Sanity-check shapes before responding.
  for (const r of successfulReviews) {
    const safe = ReviewPayload.safeParse(r.payload);
    if (!safe.success) {
      return Response.json(
        {
          error: `Reviewer ${r.reviewerId} returned a malformed payload`,
          issues: safe.error.issues,
        },
        { status: 502 },
      );
    }
  }

  return Response.json({ reveal, reviews: successfulReviews, failed });
}
