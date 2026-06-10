/**
 * Minimal binary/counting semaphore. Caps the number of concurrent operations
 * to a configured limit; the rest queue up and acquire as slots free.
 *
 * Used to prevent the harness from bursting all N panel members at OpenRouter
 * in the same millisecond — shared free-tier upstreams (Venice, Crucible, …)
 * rate-limit aggressively on simultaneous calls regardless of which model
 * variant is requested.
 */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  /**
   * Acquire a slot. Resolves with a `release` function that must be called
   * (typically in a `finally` block) when the work is done.
   */
  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.waiters.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }
}
