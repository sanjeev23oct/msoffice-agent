import { Message, ChatOptions, ChatResponse, ChatChunk, LLMConfig } from '../models/llm.types';
import { LLMProviderManager } from './llm-provider-manager';
import { CacheManager } from './cache-manager';
import { RateLimiter } from './rate-limiter';

export class LLMService {
  private providerManager: LLMProviderManager;
  private cache: CacheManager;
  private rateLimiter: RateLimiter;
  private enableCache: boolean;

  constructor(config: LLMConfig) {
    this.providerManager = new LLMProviderManager(config);
    this.cache = new CacheManager(config.cacheTTL);
    this.rateLimiter = new RateLimiter(config.maxRequests, config.windowMs);
    this.enableCache = config.enableCache ?? true;
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
    // Check cache first
    if (this.enableCache) {
      const cached = this.cache.get(messages, options);
      if (cached) {
        console.log('✅ Cache hit');
        return cached;
      }
    }

    // Rate limiting
    await this.rateLimiter.acquire();

    // Make request
    try {
      const provider = this.providerManager.getProvider();
      const response = await provider.chat(messages, options);

      // Cache response
      if (this.enableCache) {
        this.cache.set(messages, options, response);
      }

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(messages: Message[], options: ChatOptions = {}): AsyncIterator<ChatChunk> {
    await this.rateLimiter.acquire();

    try {
      const provider = this.providerManager.getProvider();
      for await (const chunk of provider.stream(messages, options)) {
        yield chunk;
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    } else if (error.status === 401) {
      return new Error('Invalid API key.');
    } else if (error.status === 500) {
      return new Error('LLM service error. Please try again.');
    }
    return error;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
