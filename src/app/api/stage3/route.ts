import { streamText } from 'ai';
import { findMember } from '@/lib/board';
import { modelFor } from '@/lib/openrouter';
import { buildChairmanSystemPrompt, buildChairmanUserPrompt } from '@/lib/prompts/chairman';
import { Stage3Request } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Stage3Request.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { question, board, chairmanId, responses, reviews } = parsed.data;

  let chairman;
  try {
    chairman = findMember(chairmanId, board);
  } catch {
    return Response.json({ error: `Unknown chairman id: ${chairmanId}` }, { status: 400 });
  }

  const responsesById = board
    .filter((m) => responses[m.id])
    .map((m) => ({ id: m.id, label: m.label, text: responses[m.id]! }));

  const reviewsForPrompt = reviews.map((r) => {
    const reviewer = board.find((m) => m.id === r.reviewerId);
    return {
      reviewerId: r.reviewerId,
      reviewerLabel: reviewer?.label ?? r.reviewerId,
      review: r.payload,
    };
  });

  const result = streamText({
    model: modelFor(chairman.model),
    system: buildChairmanSystemPrompt(),
    prompt: buildChairmanUserPrompt({
      question,
      responsesById,
      reviews: reviewsForPrompt,
    }),
  });

  return result.toTextStreamResponse();
}
