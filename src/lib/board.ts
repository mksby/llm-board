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

/**
 * Default panel: five free-tier models with one thinking-style lens each.
 * Runs end-to-end on the OpenRouter free tier — no required spend — and
 * exercises every lens so the UI lights up out of the box.
 */
const DEFAULT_BOARD: readonly BoardMember[] = [
  {
    id: 'llama',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B',
    lens: 'contrarian',
  },
  {
    id: 'qwen',
    model: 'qwen/qwen3-next-80b-a3b-instruct:free',
    label: 'Qwen 3 Next 80B',
    lens: 'first-principles',
  },
  {
    id: 'gptoss',
    model: 'openai/gpt-oss-120b:free',
    label: 'GPT-OSS 120B',
    lens: 'expansionist',
  },
  {
    id: 'nemotron',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron 3 Ultra',
    lens: 'outsider',
  },
  {
    id: 'kimi',
    model: 'moonshotai/kimi-k2.6:free',
    label: 'Kimi K2.6',
    lens: 'executor',
  },
];

/**
 * Preferred default chairman when the active roster contains it. GPT-OSS 120B
 * is the strongest free-tier synthesiser — see README "Picking a chairman".
 */
const PREFERRED_DEFAULT_CHAIRMAN: BoardMemberId = 'gptoss';

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

function resolveDefaultChairman(): BoardMemberId {
  if (envChairman && BOARD.some((m) => m.id === envChairman)) return envChairman;
  if (BOARD.some((m) => m.id === PREFERRED_DEFAULT_CHAIRMAN)) return PREFERRED_DEFAULT_CHAIRMAN;
  return BOARD[0]?.id ?? PREFERRED_DEFAULT_CHAIRMAN;
}

export const DEFAULT_CHAIRMAN_ID: BoardMemberId = resolveDefaultChairman();

export function findMember(id: BoardMemberId, board: readonly BoardMember[] = BOARD): BoardMember {
  const m = board.find((x) => x.id === id);
  if (!m) {
    throw new Error(`Unknown board member id: ${id}`);
  }
  return m;
}
