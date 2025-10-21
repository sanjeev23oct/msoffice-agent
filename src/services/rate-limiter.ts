export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[];

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await this.sleep(waitTime);
      return this.acquire(); // Retry
    }

    this.requests.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
