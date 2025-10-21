import { Message, ChatOptions, ChatResponse } from '../models/llm.types';

interface CacheEntry {
  response: ChatResponse;
  timestamp: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private ttl: number;

  constructor(ttl: number = 3600) {
    this.cache = new Map();
    this.ttl = ttl * 1000; // Convert to ms
  }

  generateKey(messages: Message[], options?: ChatOptions): string {
    return JSON.stringify({ messages, options });
  }

  get(messages: Message[], options?: ChatOptions): ChatResponse | null {
    const key = this.generateKey(messages, options);
    const cached = this.cache.get(key);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.response;
  }

  set(messages: Message[], options: ChatOptions | undefined, response: ChatResponse): void {
    const key = this.generateKey(messages, options);
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
