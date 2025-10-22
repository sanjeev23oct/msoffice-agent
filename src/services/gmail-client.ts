import { google, gmail_v1 } from 'googleapis';
import { GoogleAuthService } from './google-auth-service';
import { ProviderError, ProviderErrorType } from '../models/provider.types';

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private authService: GoogleAuthService;
  private requestQueue: Array<() => Promise<any>> = [];
  private processing: boolean = false;

  constructor(authService: GoogleAuthService) {
    this.authService = authService;
    this.gmail = google.gmail({
      version: 'v1',
      auth: authService.getOAuth2Client(),
    });
  }

  async getMessages(params: gmail_v1.Params$Resource$Users$Messages$List): Promise<gmail_v1.Schema$Message[]> {
    return this.executeWithRetry(async () => {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        ...params,
      });

      const messages: gmail_v1.Schema$Message[] = [];

      if (response.data.messages) {
        // Fetch full message details for each message
        for (const message of response.data.messages) {
          if (message.id) {
            const fullMessage = await this.getMessage(message.id);
            messages.push(fullMessage);
          }
        }
      }

      return messages;
    });
  }

  async getMessage(messageId: string): Promise<gmail_v1.Schema$Message> {
    return this.executeWithRetry(async () => {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data;
    });
  }

  async searchMessages(query: string, maxResults: number = 50): Promise<gmail_v1.Schema$Message[]> {
    return this.getMessages({
      q: query,
      maxResults,
    });
  }

  async getHistory(startHistoryId: string): Promise<gmail_v1.Schema$History[]> {
    return this.executeWithRetry(async () => {
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId,
      });

      return response.data.history || [];
    });
  }

  async getProfile(): Promise<gmail_v1.Schema$Profile> {
    return this.executeWithRetry(async () => {
      const response = await this.gmail.users.getProfile({
        userId: 'me',
      });

      return response.data;
    });
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const errorType = this.categorizeError(error);

        if (errorType === ProviderErrorType.RATE_LIMIT_EXCEEDED) {
          // Exponential backoff for rate limiting
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await this.sleep(delay);
          continue;
        }

        if (errorType === ProviderErrorType.NETWORK_ERROR && attempt < maxRetries) {
          // Retry network errors
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Network error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await this.sleep(delay);
          continue;
        }

        // For other errors, throw immediately
        throw this.normalizeError(error);
      }
    }

    // Max retries exceeded
    throw this.normalizeError(lastError);
  }

  private categorizeError(error: any): ProviderErrorType {
    if (error.code === 429 || error.message?.includes('rate limit')) {
      return ProviderErrorType.RATE_LIMIT_EXCEEDED;
    }

    if (error.code === 403) {
      return ProviderErrorType.PERMISSION_DENIED;
    }

    if (error.code === 401) {
      return ProviderErrorType.AUTHENTICATION_FAILED;
    }

    if (error.code === 404) {
      return ProviderErrorType.RESOURCE_NOT_FOUND;
    }

    if (error.code === 503 || error.message?.includes('unavailable')) {
      return ProviderErrorType.SERVICE_UNAVAILABLE;
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      return ProviderErrorType.NETWORK_ERROR;
    }

    return ProviderErrorType.UNKNOWN_ERROR;
  }

  private normalizeError(error: any): ProviderError {
    const errorType = this.categorizeError(error);
    let message = 'Gmail API error';

    if (error.message) {
      message = error.message;
    } else if (error.errors && error.errors.length > 0) {
      message = error.errors[0].message;
    }

    return new ProviderError(errorType, 'google', error, message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Queue management for rate limiting
  async queueRequest<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const operation = this.requestQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('Error processing queued request:', error);
        }

        // Add small delay between requests to avoid rate limiting
        await this.sleep(100);
      }
    }

    this.processing = false;
  }
}
