# Design Pattern: LLM Server-Side Integration

**Pattern ID:** DESIGN-001  
**Category:** Backend / AI Integration  
**Use Case:** Any application requiring LLM integration on the server  
**Last Updated:** 2025-01-20

---

## Overview

A standardized pattern for integrating Large Language Models (LLMs) into server-side applications with support for multiple providers, error handling, and cost optimization.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  (Your business logic, API routes, services)            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  LLM Service Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Provider   │  │    Cache     │  │    Rate      │ │
│  │   Manager    │  │   Manager    │  │   Limiter    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Provider Adapters                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  OpenAI  │  │ DeepSeek │  │  Claude  │  │ Ollama │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Provider Manager

**Purpose:** Abstract LLM provider differences, enable easy switching

**Interface:**
```typescript
interface ILLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  stream(messages: Message[], options?: ChatOptions): AsyncIterator<ChatChunk>;
  embeddings(text: string): Promise<number[]>;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ChatResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}
```

**Implementation Pattern:**
```javascript
// config/llm-provider.js
export class LLMProviderManager {
  constructor(config) {
    this.provider = this.createProvider(config);
  }

  createProvider(config) {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config);
      case 'deepseek':
        return new DeepSeekAdapter(config);
      case 'anthropic':
        return new AnthropicAdapter(config);
      case 'ollama':
        return new OllamaAdapter(config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  async chat(messages, options = {}) {
    return await this.provider.chat(messages, options);
  }

  async stream(messages, options = {}) {
    return await this.provider.stream(messages, options);
  }
}
```

### 2. Provider Adapters

**Purpose:** Normalize different LLM APIs to common interface

**OpenAI Adapter:**
```javascript
// adapters/openai-adapter.js
export class OpenAIAdapter {
  constructor(config) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model || 'gpt-4';
  }

  async chat(messages, options = {}) {
    const response = await this.client.chat.completions.create({
      model: options.model || this.model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

    return {
      content: response.choices[0].message.content,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      model: response.model,
    };
  }

  async *stream(messages, options = {}) {
    const stream = await this.client.chat.completions.create({
      model: options.model || this.model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield { content, done: false };
      }
    }
    yield { content: '', done: true };
  }
}
```

**DeepSeek Adapter (with role transformation):**
```javascript
// adapters/deepseek-adapter.js
export class DeepSeekAdapter extends OpenAIAdapter {
  constructor(config) {
    super({
      ...config,
      baseURL: 'https://api.deepseek.com',
    });
  }

  // Override to transform 'developer' role to 'system'
  async chat(messages, options = {}) {
    const transformedMessages = messages.map(msg => 
      msg.role === 'developer' ? { ...msg, role: 'system' } : msg
    );
    return super.chat(transformedMessages, options);
  }
}
```

### 3. Cache Manager

**Purpose:** Reduce costs and latency by caching responses

**Implementation:**
```javascript
// services/cache-manager.js
export class CacheManager {
  constructor(ttl = 3600) {
    this.cache = new Map();
    this.ttl = ttl * 1000; // Convert to ms
  }

  generateKey(messages, options) {
    return JSON.stringify({ messages, options });
  }

  get(messages, options) {
    const key = this.generateKey(messages, options);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.response;
  }

  set(messages, options, response) {
    const key = this.generateKey(messages, options);
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}
```

### 4. Rate Limiter

**Purpose:** Prevent hitting API rate limits

**Implementation:**
```javascript
// services/rate-limiter.js
export class RateLimiter {
  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async acquire() {
    const now = Date.now();
    
    // Remove old requests outside window
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await this.sleep(waitTime);
      return this.acquire(); // Retry
    }

    this.requests.push(now);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 5. LLM Service (Main Interface)

**Purpose:** Unified service combining all components

**Implementation:**
```javascript
// services/llm-service.js
export class LLMService {
  constructor(config) {
    this.provider = new LLMProviderManager(config);
    this.cache = new CacheManager(config.cacheTTL);
    this.rateLimiter = new RateLimiter(
      config.maxRequests,
      config.windowMs
    );
    this.enableCache = config.enableCache ?? true;
  }

  async chat(messages, options = {}) {
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
      const response = await this.provider.chat(messages, options);
      
      // Cache response
      if (this.enableCache) {
        this.cache.set(messages, options, response);
      }
      
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(messages, options = {}) {
    await this.rateLimiter.acquire();
    
    try {
      for await (const chunk of this.provider.stream(messages, options)) {
        yield chunk;
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    } else if (error.status === 401) {
      return new Error('Invalid API key.');
    } else if (error.status === 500) {
      return new Error('LLM service error. Please try again.');
    }
    return error;
  }
}
```

## Configuration

**Environment Variables:**
```env
# Provider Selection
LLM_PROVIDER=deepseek

# API Configuration
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

# Performance
ENABLE_CACHE=true
CACHE_TTL=3600
MAX_REQUESTS_PER_MINUTE=60

# Costs
MAX_TOKENS=1000
TEMPERATURE=0.7
```

**Config File:**
```javascript
// config/llm-config.js
export const llmConfig = {
  provider: process.env.LLM_PROVIDER || 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  model: process.env.OPENAI_MODEL || 'gpt-4',
  enableCache: process.env.ENABLE_CACHE === 'true',
  cacheTTL: parseInt(process.env.CACHE_TTL || '3600'),
  maxRequests: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60'),
  windowMs: 60000,
  maxTokens: parseInt(process.env.MAX_TOKENS || '1000'),
  temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
};
```

## Usage Examples

### Basic Chat
```javascript
import { LLMService } from './services/llm-service.js';
import { llmConfig } from './config/llm-config.js';

const llm = new LLMService(llmConfig);

const response = await llm.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
]);

console.log(response.content); // "The capital of France is Paris."
```

### Streaming Response
```javascript
const stream = llm.stream([
  { role: 'user', content: 'Tell me a story' },
]);

for await (const chunk of stream) {
  if (!chunk.done) {
    process.stdout.write(chunk.content);
  }
}
```

### With Custom Options
```javascript
const response = await llm.chat(messages, {
  model: 'gpt-4-turbo',
  temperature: 0.3,
  maxTokens: 500,
});
```

## Best Practices

### 1. Always Use Environment Variables
```javascript
// ❌ Bad
const apiKey = 'sk-abc123...';

// ✅ Good
const apiKey = process.env.OPENAI_API_KEY;
```

### 2. Implement Retry Logic
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### 3. Monitor Costs
```javascript
class CostTracker {
  constructor() {
    this.totalTokens = 0;
    this.totalCost = 0;
  }

  track(usage, model) {
    this.totalTokens += usage.totalTokens;
    this.totalCost += this.calculateCost(usage, model);
  }

  calculateCost(usage, model) {
    const rates = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'deepseek-chat': { input: 0.00014, output: 0.00028 },
    };
    
    const rate = rates[model] || rates['gpt-3.5-turbo'];
    return (
      (usage.promptTokens / 1000) * rate.input +
      (usage.completionTokens / 1000) * rate.output
    );
  }
}
```

### 4. Validate Input
```javascript
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages must be a non-empty array');
  }
  
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      throw new Error('Each message must have role and content');
    }
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      throw new Error(`Invalid role: ${msg.role}`);
    }
  }
}
```

### 5. Handle Timeouts
```javascript
async function withTimeout(promise, timeoutMs = 30000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}
```

## Testing

### Mock Provider
```javascript
// test/mocks/mock-llm-provider.js
export class MockLLMProvider {
  async chat(messages, options) {
    return {
      content: 'Mock response',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-model',
    };
  }

  async *stream(messages, options) {
    yield { content: 'Mock ', done: false };
    yield { content: 'stream', done: false };
    yield { content: '', done: true };
  }
}
```

### Integration Test
```javascript
describe('LLM Service', () => {
  it('should return response', async () => {
    const llm = new LLMService(testConfig);
    const response = await llm.chat([
      { role: 'user', content: 'Hello' },
    ]);
    expect(response.content).toBeTruthy();
  });
});
```

## Deployment Checklist

- [ ] API keys stored in environment variables
- [ ] Rate limiting configured
- [ ] Caching enabled for production
- [ ] Error handling implemented
- [ ] Cost monitoring in place
- [ ] Timeout handling configured
- [ ] Logging configured
- [ ] Health check endpoint added

## References

- OpenAI API: https://platform.openai.com/docs
- DeepSeek API: https://platform.deepseek.com/docs
- Anthropic API: https://docs.anthropic.com
- Rate Limiting: https://en.wikipedia.org/wiki/Rate_limiting

---

**Next Design:** [DESIGN-002-CopilotKit-UI-Integration.md](./DESIGN-002-CopilotKit-UI-Integration.md)
