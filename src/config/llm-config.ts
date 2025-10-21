import { LLMConfig } from '../models/llm.types';

export const llmConfig: LLMConfig = {
  provider: (process.env.LLM_PROVIDER as any) || 'openai',
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
