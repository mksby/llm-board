import { streamText } from 'ai';
import { modelFor } from '@/lib/openrouter';
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
          try {
            send({ type: 'start', memberId: member.id });
            const result = streamText({
              model: modelFor(member.model),
              prompt: question,
            });
            for await (const chunk of result.textStream) {
              send({ type: 'token', memberId: member.id, text: chunk });
            }
            send({ type: 'done', memberId: member.id });
          } catch (err) {
            send({
              type: 'error',
              memberId: member.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
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
