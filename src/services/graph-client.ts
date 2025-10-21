import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationService } from './authentication-service';

export class GraphClient {
  private client: Client | null = null;
  private authService: AuthenticationService;

  constructor(authService: AuthenticationService) {
    this.authService = authService;
  }

  initialize(): void {
    this.client = Client.init({
      authProvider: async (done) => {
        try {
          const token = await this.authService.getAccessToken([
            'User.Read',
            'Mail.Read',
            'Notes.Read',
            'Calendars.Read',
          ]);
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      },
    });
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Graph client not initialized');
    }
    return this.client;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry on authentication errors
        if (error.statusCode === 401 || error.statusCode === 403) {
          throw error;
        }

        // Retry on rate limiting or server errors
        if (error.statusCode === 429 || error.statusCode >= 500) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
          await this.sleep(delay);
          continue;
        }

        // Don't retry on other errors
        throw error;
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  logRequest(method: string, endpoint: string): void {
    console.log(`[Graph API] ${method} ${endpoint}`);
  }

  logResponse(method: string, endpoint: string, status: number): void {
    console.log(`[Graph API] ${method} ${endpoint} - ${status}`);
  }
}
