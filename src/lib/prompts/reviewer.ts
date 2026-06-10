export interface ReviewerInput {
  question: string;
  anonymized: Array<{ key: string; text: string }>;
}

export function buildReviewerSystemPrompt(): string {
  return [
    'You are a peer reviewer on a board of large language models.',
    'You receive a question along with anonymised responses from every member of the board (including possibly your own — you cannot tell which is which).',
    'Your job is to rank them on the quality of reasoning, identify the strongest and the weakest, and flag what every response missed.',
    'Be specific. Reference responses by their letter (A, B, C, ...). Do not hedge.',
  ].join(' ');
}

export function buildReviewerUserPrompt({ question, anonymized }: ReviewerInput): string {
  const blocks = anonymized
    .map(({ key, text }) => `### Response ${key}\n\n${text.trim()}`)
    .join('\n\n');

  return [
    'Question brought to the board:',
    '',
    '---',
    question.trim(),
    '---',
    '',
    'Here are the anonymised responses:',
    '',
    blocks,
    '',
    'Return your review as JSON matching the schema you have been given. Be direct. Do not include any text outside the JSON.',
  ].join('\n');
}
