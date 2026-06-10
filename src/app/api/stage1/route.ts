import { streamText } from 'ai';
import { advisorSystemPrompt } from '@/lib/lenses';
import { modelFor } from '@/lib/openrouter';
import {
  extractErrorMessage,
  getRetryAfterMs,
  isRetryableError,
  RETRY_POLICY,
} from '@/lib/retry-after';
import { Stage1Request, type Stage1Event } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Stage1Request.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
  }
  const { question, board } = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Stage1Event) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      await Promise.all(
        board.map(async (member) => {
          send({ type: 'start', memberId: member.id });
          const system = advisorSystemPrompt(member.lens);

          let lastErr: unknown;
          let totalWaitMs = 0;
          let tokensSent = 0;

          for (let attempt = 1; attempt <= RETRY_POLICY.maxAttempts; attempt++) {
            try {
              const result = streamText({
                model: modelFor(member.model),
                ...(system ? { system } : {}),
                prompt: question,
                // We do retries ourselves so we can honour upstream Retry-After
                // instead of the SDK's fixed exponential backoff.
                maxRetries: 0,
              });
              for await (const chunk of result.textStream) {
                send({ type: 'token', memberId: member.id, text: chunk });
                tokensSent++;
              }
              send({ type: 'done', memberId: member.id });
              return;
            } catch (err) {
              lastErr = err;

              // Once any tokens have been emitted to the client we cannot
              // safely retry — a second attempt would re-stream a different
              // answer on top of the partial one.
              if (tokensSent > 0) break;

              if (!isRetryableError(err) || attempt >= RETRY_POLICY.maxAttempts) break;

              const advisedMs = getRetryAfterMs(err);
              const waitMs = Math.min(
                advisedMs ?? RETRY_POLICY.defaultBackoffMs(attempt),
                RETRY_POLICY.perAttemptCapMs,
              );
              if (totalWaitMs + waitMs > RETRY_POLICY.totalCapMs) break;
              totalWaitMs += waitMs;

              send({
                type: 'retry',
                memberId: member.id,
                attempt: attempt + 1,
                maxAttempts: RETRY_POLICY.maxAttempts,
                waitMs,
                reason: extractErrorMessage(err),
              });
              await new Promise((r) => setTimeout(r, waitMs));
            }
          }

          send({
            type: 'error',
            memberId: member.id,
            error: extractErrorMessage(lastErr ?? new Error('unknown error')),
          });
        }),
      );

      send({ type: 'finish' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
