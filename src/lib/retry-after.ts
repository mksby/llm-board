/**
 * Helpers for honouring upstream `Retry-After` signals on OpenRouter.
 *
 * The AI SDK's built-in retry uses short exponential backoff (≈1/2/4 s) which
 * never reaches the 12–30 s windows free-tier upstreams (Venice, Crucible, …)
 * hand back on 429s. These helpers extract the real wait from the response
 * headers and from OpenRouter's structured error metadata so callers can wait
 * the right amount before the next attempt.
 */

/** Retry policy used by both stage 1 (streamText) and stage 2 (generateObject). */
export const RETRY_POLICY = {
  /** Total attempts including the initial call. */
  maxAttempts: 5,
  /** Hard upper bound on a single wait, so a misbehaving header can't park us forever. */
  perAttemptCapMs: 60_000,
  /** Hard upper bound on cumulative waiting across all retries. */
  totalCapMs: 180_000,
  /** Default exponential backoff when the server does not advertise a Retry-After. */
  defaultBackoffMs: (attempt: number) => Math.min(2_000 * Math.pow(2, attempt - 1), 30_000),
  /**
   * Delay between successive members' initial requests. Spreads the burst so
   * shared upstream providers (Venice, Crucible, …) don't get N simultaneous
   * hits and start handing out 429s pre-emptively.
   */
  staggerBetweenMembersMs: 600,
  /**
   * Safety margin added on top of the upstream's Retry-After. The rate-limit
   * window doesn't always clear exactly when the header promises it will.
   */
  retryAfterMarginMs: 1_500,
  /**
   * Max random extra wait added to every retry. Prevents synchronized retry
   * waves: when N members hit the same upstream at t=0 and all get told
   * "retry in 25s", they'd otherwise all retry at exactly t=25s.
   */
  retryJitterMs: 2_500,
} as const;

/** Compute the actual wait for a retry, mixing in margin and jitter. */
export function computeRetryWait(
  advisedMs: number | undefined,
  attempt: number,
): number {
  const base = advisedMs
    ? advisedMs + RETRY_POLICY.retryAfterMarginMs
    : RETRY_POLICY.defaultBackoffMs(attempt);
  const jitter = Math.random() * RETRY_POLICY.retryJitterMs;
  return Math.min(base + jitter, RETRY_POLICY.perAttemptCapMs);
}

type Maybe<T> = T | null | undefined;

interface ErrorLike {
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  data?: { error?: { message?: string; metadata?: { raw?: string; retry_after_seconds?: number } } };
  message?: string;
  lastError?: unknown;
}

function asErrorLike(err: unknown): Maybe<ErrorLike> {
  if (!err || typeof err !== 'object') return null;
  return err as ErrorLike;
}

function unwrap(err: unknown): unknown {
  const e = asErrorLike(err);
  if (e && 'lastError' in e && e.lastError !== undefined) return e.lastError;
  return err;
}

export function isRetryableError(err: unknown): boolean {
  const e = asErrorLike(unwrap(err));
  if (!e) return false;
  const code = e.statusCode;
  if (typeof code !== 'number') return false;
  return code === 429 || code === 408 || code === 503 || code === 504;
}

/**
 * Returns the wait suggested by the upstream, in milliseconds, or undefined if
 * the error does not carry one. Checks the standard `Retry-After` header first,
 * then OpenRouter's `error.metadata.retry_after_seconds` field.
 */
export function getRetryAfterMs(err: unknown): number | undefined {
  const e = asErrorLike(unwrap(err));
  if (!e) return undefined;

  const header = e.responseHeaders?.['retry-after'];
  if (header) {
    const n = Number(header);
    if (Number.isFinite(n) && n > 0) return n * 1_000;
  }

  // OpenRouter packs upstream rate-limit details into error.metadata.
  const metaSecs = e.data?.error?.metadata?.retry_after_seconds;
  if (typeof metaSecs === 'number' && metaSecs > 0) {
    return metaSecs * 1_000;
  }

  // Sometimes the body is unparsed text — try parsing it too.
  if (typeof e.responseBody === 'string') {
    try {
      const parsed = JSON.parse(e.responseBody) as ErrorLike;
      const secs = parsed.data?.error?.metadata?.retry_after_seconds;
      if (typeof secs === 'number' && secs > 0) return secs * 1_000;
    } catch {
      /* not JSON — ignore */
    }
  }

  return undefined;
}

/** Extract the most useful human-readable message we can from a provider error. */
export function extractErrorMessage(err: unknown): string {
  const inner = unwrap(err);
  const e = asErrorLike(inner);
  if (e) {
    // OpenRouter's `metadata.raw` field is the cleanest one-liner.
    const raw = e.data?.error?.metadata?.raw;
    if (raw) return raw;
    // The error object exposes its own message too.
    if (e.message) return e.message;
    // Fall back to the response body, which may be JSON.
    if (typeof e.responseBody === 'string') {
      try {
        const parsed = JSON.parse(e.responseBody) as ErrorLike;
        const rawFromBody = parsed.data?.error?.metadata?.raw;
        if (rawFromBody) return rawFromBody;
        if (parsed.data?.error?.message) return parsed.data.error.message;
      } catch {
        /* not JSON */
      }
      return e.responseBody.slice(0, 240);
    }
  }
  if (inner instanceof Error) return inner.message;
  return String(inner);
}
