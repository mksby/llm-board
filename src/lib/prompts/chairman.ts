export interface ChairmanInput {
  question: string;
  responsesById: Array<{ id: string; label: string; text: string }>;
  reviews: Array<{ reviewerId: string; reviewerLabel: string; review: unknown }>;
}

export function buildChairmanSystemPrompt(): string {
  return [
    'You are the chairman of a board of large language models.',
    'Your job is to synthesise the work of every board member and their peer reviews into a single, decisive verdict.',
    'Do not produce a balanced both-sides essay. Take a position. The user needs a real answer, not a survey.',
  ].join(' ');
}

export function buildChairmanUserPrompt({
  question,
  responsesById,
  reviews,
}: ChairmanInput): string {
  const responseBlocks = responsesById
    .map(({ label, text }) => `### ${label}\n\n${text.trim()}`)
    .join('\n\n');

  const reviewBlocks = reviews
    .map(
      ({ reviewerLabel, review }) =>
        `### Review by ${reviewerLabel}\n\n${JSON.stringify(review, null, 2)}`,
    )
    .join('\n\n');

  return [
    'Question brought to the board:',
    '',
    '---',
    question.trim(),
    '---',
    '',
    'BOARD RESPONSES (de-anonymised):',
    '',
    responseBlocks,
    '',
    'PEER REVIEWS:',
    '',
    reviewBlocks,
    '',
    'Produce the final verdict using exactly this Markdown structure:',
    '',
    '## Where the board agrees',
    '<points multiple members converged on independently — high-confidence signals>',
    '',
    '## Where the board splits',
    '<the genuine disagreements; do not paper over them>',
    '',
    '## Blind spots caught in peer review',
    '<things only surfaced when members reviewed each other>',
    '',
    '## Recommendation',
    "<a clear, direct recommendation; not 'it depends'>",
    '',
    '## The one thing to do first',
    '<a single concrete next step>',
  ].join('\n');
}
