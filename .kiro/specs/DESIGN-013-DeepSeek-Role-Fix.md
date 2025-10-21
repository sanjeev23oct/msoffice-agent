# Design Pattern: DeepSeek Role Transformation Fix

**Pattern ID:** DESIGN-013  
**Category:** Backend / AI Integration / Bug Fix  
**Use Case:** Fix "developer" role error when using DeepSeek with CopilotKit  
**Last Updated:** 2025-01-20

---

## Problem

When using DeepSeek API with CopilotKit, you get this error:

```
Error: 400 Failed to deserialize the JSON body into the target type: 
messages[0].role: unknown variant `developer`, expected one of 
`system`, `user`, `assistant`, `tool` at line 6 column 25
```

**Root Cause:**
- CopilotKit sends messages with `role: 'developer'`
- DeepSeek API only accepts: `system`, `user`, `assistant`, `tool`
- OpenAI supports `developer` role, but DeepSeek doesn't

## Solution Overview

Transform `developer` role to `system` role before sending to DeepSeek API.

## Implementation Methods

### Method 1: Custom Fetch (Recommended for CopilotKit)

**Best for:** Server-side CopilotKit runtime integration

```javascript
// server/config/deepseek-client.js
import OpenAI from 'openai';

export function createDeepSeekClient() {
  // Custom fetch that transforms developer role
  const customFetch = async (url, options) => {
    if (options?.body && typeof options.body === 'string') {
      try {
        const body = JSON.parse(options.body);
        
        // Transform messages if they exist
        if (body.messages && Array.isArray(body.messages)) {
          let transformed = false;
          
          body.messages = body.messages.map(msg => {
            if (msg.role === 'developer') {
              console.log('🔄 Converting developer role to system role');
              transformed = true;
              return { ...msg, role: 'system' };
            }
            return msg;
          });
          
          if (transformed) {
            // Update body with transformed messages
            const newBody = JSON.stringify(body);
            const newOptions = { ...options };
            newOptions.body = newBody;
            
            // Remove Content-Length header so fetch recalculates it
            if (newOptions.headers) {
              const newHeaders = { ...newOptions.headers };
              delete newHeaders['Content-Length'];
              delete newHeaders['content-length'];
              newOptions.headers = newHeaders;
            }
            
            return fetch(url, newOptions);
          }
        }
      } catch (e) {
        // Not JSON or parsing failed, continue with original
        console.error('Error parsing request body:', e);
      }
    }
    
    // No transformation needed, use original
    return fetch(url, options);
  };

  // Create OpenAI client with custom fetch
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
    fetch: customFetch,
  });
}
```

**Usage with CopilotKit:**
```javascript
// server/copilotkit-server.js
import { CopilotRuntime, OpenAIAdapter } from '@copilotkit/runtime';
import { createDeepSeekClient } from './config/deepseek-client.js';

const deepseekClient = createDeepSeekClient();

const serviceAdapter = new OpenAIAdapter({
  model: process.env.OPENAI_MODEL || 'deepseek-chat',
  openai: deepseekClient,
});

const runtime = new CopilotRuntime();

app.use('/copilotkit', copilotRuntimeNodeHttpEndpoint({
  endpoint: '/copilotkit',
  runtime,
  serviceAdapter,
}));
```

### Method 2: Adapter Pattern

**Best for:** Custom LLM service implementations

```javascript
// services/deepseek-adapter.js
export class DeepSeekAdapter {
  constructor(config) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com',
    });
    this.model = config.model || 'deepseek-chat';
  }

  transformMessages(messages) {
    return messages.map(msg => {
      if (msg.role === 'developer') {
        console.log('🔄 Converting developer → system');
        return { ...msg, role: 'system' };
      }
      return msg;
    });
  }

  async chat(messages, options = {}) {
    const transformed = this.transformMessages(messages);
    
    const response = await this.client.chat.completions.create({
      model: options.model || this.model,
      messages: transformed,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

    return {
      content: response.choices[0].message.content,
      usage: response.usage,
      model: response.model,
    };
  }

  async *stream(messages, options = {}) {
    const transformed = this.transformMessages(messages);
    
    const stream = await this.client.chat.completions.create({
      model: options.model || this.model,
      messages: transformed,
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

**Usage:**
```javascript
import { DeepSeekAdapter } from './services/deepseek-adapter.js';

const deepseek = new DeepSeekAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'deepseek-chat',
});

const response = await deepseek.chat([
  { role: 'developer', content: 'You are a helpful assistant' }, // Will be transformed
  { role: 'user', content: 'Hello!' },
]);
```

### Method 3: Middleware Pattern

**Best for:** Express/Node.js applications

```javascript
// middleware/role-transformer.js
export function roleTransformerMiddleware(req, res, next) {
  // Only transform for DeepSeek endpoints
  if (req.path.includes('/copilotkit') || req.path.includes('/chat')) {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.messages) {
            parsed.messages = parsed.messages.map(msg =>
              msg.role === 'developer' ? { ...msg, role: 'system' } : msg
            );
            data = JSON.stringify(parsed);
          }
        } catch (e) {
          // Not JSON, continue
        }
      }
      originalSend.call(this, data);
    };
  }
  
  next();
}
```

**Usage:**
```javascript
import express from 'express';
import { roleTransformerMiddleware } from './middleware/role-transformer.js';

const app = express();
app.use(roleTransformerMiddleware);
```

## Complete Example

**Full server setup with role transformation:**

```javascript
// server/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from '@copilotkit/runtime';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Custom fetch for DeepSeek role transformation
const customFetch = async (url, options) => {
  if (options?.body && typeof options.body === 'string') {
    try {
      const body = JSON.parse(options.body);
      if (body.messages && Array.isArray(body.messages)) {
        body.messages = body.messages.map(msg => 
          msg.role === 'developer' ? { ...msg, role: 'system' } : msg
        );
        options.body = JSON.stringify(body);
        if (options.headers) {
          const newHeaders = { ...options.headers };
          delete newHeaders['Content-Length'];
          delete newHeaders['content-length'];
          options.headers = newHeaders;
        }
      }
    } catch (e) {
      // Continue with original
    }
  }
  return fetch(url, options);
};

// Create OpenAI client with custom fetch
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
  fetch: customFetch,
});

// Create CopilotKit adapter
const serviceAdapter = new OpenAIAdapter({
  model: process.env.OPENAI_MODEL || 'deepseek-chat',
  openai,
});

const runtime = new CopilotRuntime();

// Mount CopilotKit endpoint
app.use('/copilotkit', copilotRuntimeNodeHttpEndpoint({
  endpoint: '/copilotkit',
  runtime,
  serviceAdapter,
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔄 DeepSeek role transformation enabled`);
});
```

## Testing

### Test the Transformation

```javascript
// test/deepseek-role-transform.test.js
import { describe, it, expect } from 'vitest';
import { createDeepSeekClient } from '../server/config/deepseek-client.js';

describe('DeepSeek Role Transformation', () => {
  it('should transform developer role to system', async () => {
    const client = createDeepSeekClient();
    
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'developer', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    });
    
    expect(response.choices[0].message.content).toBeTruthy();
  });
});
```

## Environment Configuration

```env
# .env
LLM_PROVIDER=deepseek
OPENAI_API_KEY=sk-your-deepseek-key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

## Verification

After implementing, you should see:

```
✅ Server running on port 3001
🔄 Converting developer role to system role
✅ LLM configured:
   URL: https://api.deepseek.com
   Model: deepseek-chat
```

And no more 400 errors!

## Why This Happens

### CopilotKit's Role Usage

CopilotKit uses the `developer` role for system instructions:

```javascript
// CopilotKit internally sends:
{
  messages: [
    { role: 'developer', content: 'System instructions...' },
    { role: 'user', content: 'User message' }
  ]
}
```

### OpenAI vs DeepSeek

| Role | OpenAI | DeepSeek |
|------|--------|----------|
| `system` | ✅ | ✅ |
| `user` | ✅ | ✅ |
| `assistant` | ✅ | ✅ |
| `tool` | ✅ | ✅ |
| `developer` | ✅ | ❌ |

## Best Practices

### 1. Log Transformations

```javascript
if (msg.role === 'developer') {
  console.log('🔄 Converting developer → system');
  return { ...msg, role: 'system' };
}
```

### 2. Handle Errors Gracefully

```javascript
try {
  const body = JSON.parse(options.body);
  // Transform...
} catch (e) {
  console.error('Error transforming roles:', e);
  // Continue with original request
}
```

### 3. Test with Both Providers

```javascript
// Test with OpenAI (should work with developer role)
// Test with DeepSeek (should work with transformation)
```

### 4. Document the Fix

Add to your README:
```markdown
## DeepSeek Configuration

This project uses DeepSeek API which doesn't support the `developer` role.
We automatically transform `developer` → `system` in the server configuration.
```

## Alternative: Use OpenAI Instead

If you don't want to deal with role transformation:

```env
# Use OpenAI (supports developer role natively)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-openai-key
OPENAI_MODEL=gpt-4-turbo
```

Or use Ollama locally:

```env
# Use Ollama (local, free)
LLM_PROVIDER=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama2
OPENAI_API_KEY=dummy
```

## References

- DeepSeek API Docs: https://platform.deepseek.com/docs
- OpenAI API Roles: https://platform.openai.com/docs/guides/chat
- CopilotKit Runtime: https://docs.copilotkit.ai

---

**Related Patterns:**
- [DESIGN-001: LLM Server Integration](./DESIGN-001-LLM-Server-Integration.md)
- [DESIGN-002: CopilotKit UI Integration](./DESIGN-002-CopilotKit-UI-Integration.md)
