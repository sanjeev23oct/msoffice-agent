import { GraphClient } from './graph-client';
import { IEmailService, Email, EmailAddress } from '../models/email.types';
import { IEmailProvider, EmailWithProvider } from '../models/provider.types';
import { AuthenticationService } from './authentication-service';

export class EmailService implements IEmailService, IEmailProvider {
  readonly providerType = 'microsoft' as const;
  readonly accountId: string;

  private graphClient: GraphClient;
  private authService: AuthenticationService;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private pollInterval: number;
  private deltaLink: string | null = null;
  private changeCallbacks: Array<(email: Email) => void> = [];
  private providerChangeCallbacks: Array<(email: EmailWithProvider) => void> = [];
  private emailCache: Map<string, EmailWithProvider> = new Map();

  constructor(graphClient: GraphClient, authService: AuthenticationService, pollInterval: number = 30000) {
    this.graphClient = graphClient;
    this.authService = authService;
    this.accountId = authService.accountId;
    this.pollInterval = pollInterval;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Email monitoring already started');
      return;
    }

    this.isMonitoring = true;
    console.log('Starting email monitoring...');

    // Initial fetch
    await this.checkForNewEmails();

    // Set up polling
    this.monitoringInterval = setInterval(async () => {
      await this.checkForNewEmails();
    }, this.pollInterval);
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Email monitoring stopped');
  }

  private async checkForNewEmails(): Promise<void> {
    try {
      const client = this.graphClient.getClient();

      // Use delta query for efficient change tracking
      let request = this.deltaLink
        ? client.api(this.deltaLink)
        : client.api('/me/messages/delta').top(50);

      const response = await this.graphClient.executeWithRetry(() => request.get());

      // Process new/changed emails
      if (response.value && response.value.length > 0) {
        for (const rawEmail of response.value) {
          const email = this.mapToEmail(rawEmail);
          
          // Check if this is a new email (not in cache)
          if (!this.emailCache.has(email.id)) {
            this.emailCache.set(email.id, email);
            
            // Notify subscribers
            this.changeCallbacks.forEach((callback) => callback(email));
          }
        }
      }

      // Update delta link for next query
      this.deltaLink = response['@odata.deltaLink'] || this.deltaLink;
    } catch (error) {
      console.error('Error checking for new emails:', error);
    }
  }

  async getRecentEmails(count: number): Promise<EmailWithProvider[]> {
    const client = this.graphClient.getClient();

    const response = await this.graphClient.executeWithRetry(() =>
      client
        .api('/me/messages')
        .top(count)
        .orderby('receivedDateTime DESC')
        .get()
    );

    return response.value.map((rawEmail: any) => this.mapToEmail(rawEmail));
  }

  async getEmailById(id: string): Promise<EmailWithProvider> {
    // Check cache first
    if (this.emailCache.has(id)) {
      return this.emailCache.get(id)! as EmailWithProvider;
    }

    const client = this.graphClient.getClient();

    const rawEmail = await this.graphClient.executeWithRetry(() =>
      client.api(`/me/messages/${id}`).get()
    );

    const email = this.mapToEmail(rawEmail);
    this.emailCache.set(id, email);
    return email;
  }

  async searchEmails(query: string): Promise<EmailWithProvider[]> {
    const client = this.graphClient.getClient();

    const response = await this.graphClient.executeWithRetry(() =>
      client
        .api('/me/messages')
        .filter(`contains(subject,'${query}') or contains(body/content,'${query}')`)
        .top(50)
        .orderby('receivedDateTime DESC')
        .get()
    );

    return response.value.map((rawEmail: any) => this.mapToEmail(rawEmail));
  }

  subscribeToChanges(callback: (email: EmailWithProvider) => void): void {
    this.providerChangeCallbacks.push(callback);
    // Also support old callback format for backward compatibility
    this.changeCallbacks.push(callback as any);
  }

  private mapToEmail(rawEmail: any): EmailWithProvider {
    const accountInfo = this.authService.getAccountInfo();
    
    return {
      id: rawEmail.id,
      subject: rawEmail.subject || '(No Subject)',
      from: this.mapEmailAddress(rawEmail.from?.emailAddress),
      to: rawEmail.toRecipients?.map((r: any) => this.mapEmailAddress(r.emailAddress)) || [],
      cc: rawEmail.ccRecipients?.map((r: any) => this.mapEmailAddress(r.emailAddress)),
      body: rawEmail.body?.content || '',
      receivedDateTime: new Date(rawEmail.receivedDateTime),
      hasAttachments: rawEmail.hasAttachments || false,
      importance: rawEmail.importance || 'normal',
      isRead: rawEmail.isRead || false,
      conversationId: rawEmail.conversationId || '',
      providerType: 'microsoft',
      accountId: this.accountId,
      accountEmail: accountInfo.email,
      metadata: {
        categories: rawEmail.categories,
      },
    };
  }

  private mapEmailAddress(address: any): EmailAddress {
    return {
      name: address?.name || '',
      address: address?.address || '',
    };
  }

  clearCache(): void {
    this.emailCache.clear();
  }
}
