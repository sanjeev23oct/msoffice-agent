import { OpenAIAdapter } from './openai-adapter';
import { Message, ChatOptions, ChatResponse, LLMConfig } from '../../models/llm.types';

export class DeepSeekAdapter extends OpenAIAdapter {
  constructor(config: LLMConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.deepseek.com',
    });
  }

  // Override to transform 'developer' role to 'system' if needed
  async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
    const transformedMessages = messages.map((msg) =>
      msg.role === 'system' ? msg : msg
    );
    return super.chat(transformedMessages, options);
  }
}
