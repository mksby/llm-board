import { isLensId, type LensId } from './lenses';

export interface BoardMember {
  /** Stable internal id, used as a key and in env overrides. */
  id: string;
  /** OpenRouter model slug, e.g. `anthropic/claude-opus-4`. */
  model: string;
  /** Human-readable label for the UI. */
  label: string;
  /** Optional thinking-style overlay applied via system prompt in stage 1. */
  lens?: LensId;
}

export type BoardMemberId = BoardMember['id'];

const DEFAULT_BOARD: readonly BoardMember[] = [
  { id: 'opus', model: 'anthropic/claude-opus-4.7', label: 'Claude Opus 4.7' },
  { id: 'gemini', model: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { id: 'qwen', model: 'qwen/qwen3-max', label: 'Qwen 3 Max' },
];

/**
 * Parse an env override of the form
 *   `id|slug|label[|lens],id|slug|label[|lens],...`
 *
 * `|` separates fields so model slugs that contain `:` (e.g. OpenRouter
 * `:free` variants) round-trip correctly. The lens field is optional; when
 * present it must be one of the known `LensId` values, otherwise the whole
 * roster is rejected and the default board is used.
 *
 * Returns `null` on any malformed entry so callers fall back to the default.
 */
function parseRoster(raw: string | undefined): BoardMember[] | null {
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const out: BoardMember[] = [];
  for (const part of parts) {
    const segments = part.split('|').map((s) => s.trim());
    if (segments.length < 3 || segments.length > 4) return null;
    const [id, model, label, lensRaw] = segments;
    if (!id || !model || !label) return null;
    let lens: LensId | undefined;
    if (lensRaw) {
      if (!isLensId(lensRaw)) return null;
      lens = lensRaw;
    }
    out.push(lens ? { id, model, label, lens } : { id, model, label });
  }
  return out;
}

const parsed = parseRoster(process.env.BOARD_ROSTER);

export const BOARD: readonly BoardMember[] = parsed ?? DEFAULT_BOARD;

const envChairman = process.env.CHAIRMAN_ID?.trim();

export const DEFAULT_CHAIRMAN_ID: BoardMemberId =
  envChairman && BOARD.some((m) => m.id === envChairman) ? envChairman : (BOARD[0]?.id ?? 'opus');

export function findMember(id: BoardMemberId, board: readonly BoardMember[] = BOARD): BoardMember {
  const m = board.find((x) => x.id === id);
  if (!m) {
    throw new Error(`Unknown board member id: ${id}`);
  }
  return m;
}
