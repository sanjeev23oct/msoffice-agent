import { ILLMProvider, LLMConfig } from '../models/llm.types';
import { OpenAIAdapter } from './adapters/openai-adapter';
import { DeepSeekAdapter } from './adapters/deepseek-adapter';

export class LLMProviderManager {
  private provider: ILLMProvider;

  constructor(config: LLMConfig) {
    this.provider = this.createProvider(config);
  }

  private createProvider(config: LLMConfig): ILLMProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config);
      case 'deepseek':
        return new DeepSeekAdapter(config);
      case 'anthropic':
        // TODO: Implement AnthropicAdapter
        throw new Error('Anthropic adapter not yet implemented');
      case 'ollama':
        // TODO: Implement OllamaAdapter
        throw new Error('Ollama adapter not yet implemented');
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  getProvider(): ILLMProvider {
    return this.provider;
  }
}
