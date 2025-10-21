import OpenAI from 'openai';

/**
 * Creates a DeepSeek-compatible OpenAI client with role transformation
 * Transforms 'developer' role to 'system' role for DeepSeek API compatibility
 */
export function createDeepSeekClient(config: {
  apiKey: string;
  baseURL?: string;
  model?: string;
}) {
  // Custom fetch that transforms developer role
  const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    if (options?.body && typeof options.body === 'string') {
      try {
        const body = JSON.parse(options.body);

        // Transform messages if they exist
        if (body.messages && Array.isArray(body.messages)) {
          let transformed = false;

          body.messages = body.messages.map((msg: any) => {
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
              const newHeaders = { ...newOptions.headers } as any;
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
    apiKey: config.apiKey,
    baseURL: config.baseURL || 'https://api.deepseek.com',
    fetch: customFetch as any,
  });
}
