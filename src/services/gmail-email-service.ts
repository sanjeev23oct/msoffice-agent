import { gmail_v1 } from 'googleapis';
import { GmailClient } from './gmail-client';
import { GoogleAuthService } from './google-auth-service';
import { IEmailProvider, EmailWithProvider } from '../models/provider.types';

export class GmailEmailService implements IEmailProvider {
  readonly providerType = 'google' as const;
  readonly accountId: string;

  private client: GmailClient;
  private authService: GoogleAuthService;
  private monitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastHistoryId: string | null = null;
  private changeCallbacks: Array<(email: EmailWithProvider) => void> = [];

  constructor(authService: GoogleAuthService) {
    this.authService = authService;
    this.accountId = authService.accountId;
    this.client = new GmailClient(authService);
  }

  async startMonitoring(): Promise<void> {
    if (this.monitoring) {
      console.log('Gmail monitoring already started');
      return;
    }

    console.log('📧 Starting Gmail monitoring...');

    // Get initial history ID
    const profile = await this.client.getProfile();
    this.lastHistoryId = profile.historyId || null;

    this.monitoring = true;

    // Poll for changes every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.checkForChanges();
    }, 30000);

    console.log('✅ Gmail monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.monitoring) {
      return;
    }

    console.log('Stopping Gmail monitoring...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.monitoring = false;
    console.log('✅ Gmail monitoring stopped');
  }

  async getRecentEmails(count: number): Promise<EmailWithProvider[]> {
    try {
      const messages = await this.client.getMessages({
        maxResults: count,
        labelIds: ['INBOX'],
      });

      return messages.map((msg) => this.mapGmailMessageToEmail(msg));
    } catch (error) {
      console.error('Error getting recent emails:', error);
      return [];
    }
  }

  async getEmailById(id: string): Promise<EmailWithProvider> {
    const message = await this.client.getMessage(id);
    return this.mapGmailMessageToEmail(message);
  }

  async searchEmails(query: string): Promise<EmailWithProvider[]> {
    try {
      const messages = await this.client.searchMessages(query, 50);
      return messages.map((msg) => this.mapGmailMessageToEmail(msg));
    } catch (error) {
      console.error('Error searching emails:', error);
      return [];
    }
  }

  subscribeToChanges(callback: (email: EmailWithProvider) => void): void {
    this.changeCallbacks.push(callback);
  }

  clearCache(): void {
    // Gmail API doesn't require local caching as it's always fetched from server
    console.log('Gmail cache cleared (no-op)');
  }

  private async checkForChanges(): Promise<void> {
    if (!this.lastHistoryId) {
      return;
    }

    try {
      const history = await this.client.getHistory(this.lastHistoryId);

      for (const historyRecord of history) {
        // Update last history ID
        if (historyRecord.id) {
          this.lastHistoryId = historyRecord.id;
        }

        // Process new messages
        if (historyRecord.messagesAdded) {
          for (const added of historyRecord.messagesAdded) {
            if (added.message && added.message.id) {
              const email = await this.getEmailById(added.message.id);
              this.notifyChange(email);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for changes:', error);
    }
  }

  private notifyChange(email: EmailWithProvider): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(email);
      } catch (error) {
        console.error('Error in change callback:', error);
      }
    }
  }

  private mapGmailMessageToEmail(message: gmail_v1.Schema$Message): EmailWithProvider {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract email body
    let body = '';
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      // Multi-part message
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
      // Fallback to HTML if no plain text
      if (!body) {
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }
    }

    // Parse from address
    const fromHeader = getHeader('from');
    const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/) || fromHeader.match(/^(.+)$/);
    const fromName = fromMatch ? fromMatch[1].trim().replace(/"/g, '') : 'Unknown';
    const fromAddress = fromMatch && fromMatch[2] ? fromMatch[2].trim() : fromHeader;

    // Parse to addresses
    const toHeader = getHeader('to');
    const toAddresses = this.parseEmailAddresses(toHeader);

    // Parse cc addresses
    const ccHeader = getHeader('cc');
    const ccAddresses = ccHeader ? this.parseEmailAddresses(ccHeader) : undefined;

    // Determine importance
    let importance: 'low' | 'normal' | 'high' = 'normal';
    const labels = message.labelIds || [];
    if (labels.includes('IMPORTANT')) {
      importance = 'high';
    }

    // Check if read
    const isRead = !labels.includes('UNREAD');

    // Check for attachments
    const hasAttachments = message.payload?.parts?.some((part) => part.filename && part.filename.length > 0) || false;

    const accountInfo = this.authService.getAccountInfo();

    return {
      id: message.id || '',
      subject: getHeader('subject') || '(No Subject)',
      from: {
        name: fromName,
        address: fromAddress,
      },
      to: toAddresses,
      cc: ccAddresses,
      body,
      receivedDateTime: new Date(parseInt(message.internalDate || '0')),
      hasAttachments,
      importance,
      isRead,
      conversationId: message.threadId || message.id || '',
      providerType: 'google',
      accountId: this.accountId,
      accountEmail: accountInfo.email,
      metadata: {
        labels: message.labelIds,
        threadId: message.threadId,
      },
    };
  }

  private parseEmailAddresses(addressString: string): Array<{ name: string; address: string }> {
    if (!addressString) {
      return [];
    }

    const addresses: Array<{ name: string; address: string }> = [];
    const parts = addressString.split(',');

    for (const part of parts) {
      const match = part.trim().match(/^(.+?)\s*<(.+?)>$/) || part.trim().match(/^(.+)$/);
      if (match) {
        const name = match[2] ? match[1].trim().replace(/"/g, '') : match[1].trim();
        const address = match[2] ? match[2].trim() : match[1].trim();
        addresses.push({ name, address });
      }
    }

    return addresses;
  }
}
