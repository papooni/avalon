/** Token-bucket rate limiter keyed by an arbitrary string (socket id, IP, …). */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; updated: number }>();
  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string, cost = 1): boolean {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, updated: t };
    b.tokens = Math.min(this.capacity, b.tokens + ((t - b.updated) / 1000) * this.refillPerSecond);
    b.updated = t;
    const allowed = b.tokens >= cost;
    if (allowed) b.tokens -= cost;
    this.buckets.set(key, b);
    if (this.buckets.size > 50_000) this.prune(t);
    return allowed;
  }

  private prune(t: number) {
    for (const [k, b] of this.buckets) if (t - b.updated > 10 * 60_000) this.buckets.delete(k);
  }
}
