import { OpenAIAdapter } from '@copilotkit/runtime';

/**
 * Custom OpenAI adapter that transforms 'developer' role to 'system'
 * for compatibility with DeepSeek and other providers
 */
export class CustomOpenAIAdapter extends OpenAIAdapter {
  async process(params: any): Promise<any> {
    // Transform messages before processing
    if (params.messages) {
      params.messages = params.messages.map((msg: any) => ({
        ...msg,
        role: msg.role === 'developer' ? 'system' : msg.role,
      }));
    }
    
    return super.process(params);
  }
}
