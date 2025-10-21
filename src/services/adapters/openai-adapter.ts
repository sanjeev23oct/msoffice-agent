import OpenAI from 'openai';
import {
  ILLMProvider,
  Message,
  ChatOptions,
  ChatResponse,
  ChatChunk,
  LLMConfig,
} from '../../models/llm.types';

export class OpenAIAdapter implements ILLMProvider {
  protected client: OpenAI;
  protected model: string;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model || 'gpt-4';
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model || this.model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

    return {
      content: response.choices[0].message.content || '',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      model: response.model,
    };
  }

  async *stream(messages: Message[], options: ChatOptions = {}): AsyncIterator<ChatChunk> {
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
