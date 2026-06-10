/**
 * Anonymise a set of responses for the peer-review stage.
 *
 * Each entry comes in keyed by its real board-member id (`opus`, `gemini`, ...).
 * We re-label them as `A`, `B`, `C`, ... after a random shuffle so reviewers
 * cannot tell which response belongs to which model. The mapping is returned
 * separately so callers can de-anonymise once peer review is done.
 */

export type AnonymizedKey = string; // 'A' | 'B' | ...

export interface AnonymizationResult<T> {
  /** Items in shuffled order, keyed by anonymous label. */
  shuffled: Array<{ key: AnonymizedKey; value: T }>;
  /** Map from anonymous label -> original id. */
  reveal: Record<AnonymizedKey, string>;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function fisherYates<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export function anonymize<T>(items: Array<{ id: string; value: T }>): AnonymizationResult<T> {
  if (items.length > ALPHABET.length) {
    throw new Error(`anonymize: cannot handle more than ${ALPHABET.length} items`);
  }
  const shuffledItems = fisherYates(items);
  const shuffled: AnonymizationResult<T>['shuffled'] = [];
  const reveal: Record<AnonymizedKey, string> = {};
  for (let i = 0; i < shuffledItems.length; i++) {
    const item = shuffledItems[i]!;
    const key = ALPHABET[i]!;
    shuffled.push({ key, value: item.value });
    reveal[key] = item.id;
  }
  return { shuffled, reveal };
}
