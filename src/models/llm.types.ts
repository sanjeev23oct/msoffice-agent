export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface ChatChunk {
  content: string;
  done: boolean;
}

export interface ILLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  stream(messages: Message[], options?: ChatOptions): AsyncIterator<ChatChunk>;
}

export interface LLMConfig {
  provider: 'openai' | 'deepseek' | 'anthropic' | 'ollama';
  apiKey?: string;
  baseURL?: string;
  model: string;
  enableCache?: boolean;
  cacheTTL?: number;
  maxRequests?: number;
  windowMs?: number;
  maxTokens?: number;
  temperature?: number;
}
