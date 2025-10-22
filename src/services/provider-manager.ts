import {
  IAuthProvider,
  IEmailProvider,
  ICalendarProvider,
  INotesProvider,
  AccountInfo,
  EmailWithProvider,
  MeetingWithProvider,
  NoteWithProvider,
  ProviderType,
} from '../models/provider.types';

export class ProviderManager {
  private authProviders: Map<string, IAuthProvider> = new Map();
  private emailProviders: Map<string, IEmailProvider> = new Map();
  private calendarProviders: Map<string, ICalendarProvider> = new Map();
  private notesProviders: Map<string, INotesProvider> = new Map();

  // Register providers
  registerAuthProvider(accountId: string, provider: IAuthProvider): void {
    this.authProviders.set(accountId, provider);
  }

  registerEmailProvider(accountId: string, provider: IEmailProvider): void {
    this.emailProviders.set(accountId, provider);
  }

  registerCalendarProvider(accountId: string, provider: ICalendarProvider): void {
    this.calendarProviders.set(accountId, provider);
  }

  registerNotesProvider(accountId: string, provider: INotesProvider): void {
    this.notesProviders.set(accountId, provider);
  }

  // Remove providers
  removeAccount(accountId: string): void {
    this.authProviders.delete(accountId);
    this.emailProviders.delete(accountId);
    this.calendarProviders.delete(accountId);
    this.notesProviders.delete(accountId);
  }

  // Get providers
  getAuthProvider(accountId: string): IAuthProvider | undefined {
    return this.authProviders.get(accountId);
  }

  getEmailProvider(accountId: string): IEmailProvider | undefined {
    return this.emailProviders.get(accountId);
  }

  getCalendarProvider(accountId: string): ICalendarProvider | undefined {
    return this.calendarProviders.get(accountId);
  }

  getNotesProvider(accountId: string): INotesProvider | undefined {
    return this.notesProviders.get(accountId);
  }

  // Get all accounts
  getAccounts(): AccountInfo[] {
    const accounts: AccountInfo[] = [];
    
    for (const [accountId, authProvider] of this.authProviders) {
      if (authProvider.isAuthenticated()) {
        try {
          accounts.push(authProvider.getAccountInfo());
        } catch (error) {
          console.error(`Error getting account info for ${accountId}:`, error);
        }
      }
    }

    return accounts;
  }

  // Get accounts by provider type
  getAccountsByProvider(providerType: ProviderType): AccountInfo[] {
    return this.getAccounts().filter((account) => account.providerType === providerType);
  }

  // Unified operations across all providers

  async getAllRecentEmails(count: number): Promise<EmailWithProvider[]> {
    const allEmails: EmailWithProvider[] = [];

    for (const [accountId, emailProvider] of this.emailProviders) {
      try {
        const emails = await emailProvider.getRecentEmails(count);
        allEmails.push(...emails);
      } catch (error) {
        console.error(`Error getting emails from ${accountId}:`, error);
      }
    }

    // Sort by date, most recent first
    allEmails.sort((a, b) => b.receivedDateTime.getTime() - a.receivedDateTime.getTime());

    return allEmails.slice(0, count);
  }

  async getAllUpcomingMeetings(days: number): Promise<MeetingWithProvider[]> {
    const allMeetings: MeetingWithProvider[] = [];

    for (const [accountId, calendarProvider] of this.calendarProviders) {
      try {
        const meetings = await calendarProvider.getUpcomingMeetings(days);
        allMeetings.push(...meetings);
      } catch (error) {
        console.error(`Error getting meetings from ${accountId}:`, error);
      }
    }

    // Sort by start time
    allMeetings.sort((a, b) => a.start.getTime() - b.start.getTime());

    return allMeetings;
  }

  async searchAllEmails(query: string): Promise<EmailWithProvider[]> {
    const allEmails: EmailWithProvider[] = [];

    for (const [accountId, emailProvider] of this.emailProviders) {
      try {
        const emails = await emailProvider.searchEmails(query);
        allEmails.push(...emails);
      } catch (error) {
        console.error(`Error searching emails in ${accountId}:`, error);
      }
    }

    // Sort by date, most recent first
    allEmails.sort((a, b) => b.receivedDateTime.getTime() - a.receivedDateTime.getTime());

    return allEmails;
  }

  async searchAllNotes(query: string): Promise<NoteWithProvider[]> {
    const allNotes: NoteWithProvider[] = [];

    for (const [accountId, notesProvider] of this.notesProviders) {
      try {
        const notes = await notesProvider.searchNotes(query);
        allNotes.push(...notes);
      } catch (error) {
        console.error(`Error searching notes in ${accountId}:`, error);
      }
    }

    // Sort by last modified, most recent first
    allNotes.sort((a, b) => b.lastModifiedDateTime.getTime() - a.lastModifiedDateTime.getTime());

    return allNotes;
  }

  // Start/stop monitoring for all email providers
  async startAllMonitoring(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [accountId, emailProvider] of this.emailProviders) {
      promises.push(
        emailProvider.startMonitoring().catch((error) => {
          console.error(`Error starting monitoring for ${accountId}:`, error);
        })
      );
    }

    await Promise.all(promises);
  }

  async stopAllMonitoring(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [accountId, emailProvider] of this.emailProviders) {
      promises.push(
        emailProvider.stopMonitoring().catch((error) => {
          console.error(`Error stopping monitoring for ${accountId}:`, error);
        })
      );
    }

    await Promise.all(promises);
  }

  // Get provider statistics
  getProviderStats(): {
    totalAccounts: number;
    microsoftAccounts: number;
    googleAccounts: number;
    emailProviders: number;
    calendarProviders: number;
    notesProviders: number;
  } {
    const accounts = this.getAccounts();

    return {
      totalAccounts: accounts.length,
      microsoftAccounts: accounts.filter((a) => a.providerType === 'microsoft').length,
      googleAccounts: accounts.filter((a) => a.providerType === 'google').length,
      emailProviders: this.emailProviders.size,
      calendarProviders: this.calendarProviders.size,
      notesProviders: this.notesProviders.size,
    };
  }

  // Check if any provider is authenticated
  hasAuthenticatedProvider(): boolean {
    for (const [_, authProvider] of this.authProviders) {
      if (authProvider.isAuthenticated()) {
        return true;
      }
    }
    return false;
  }

  // Get primary account (first authenticated account)
  getPrimaryAccount(): AccountInfo | null {
    const accounts = this.getAccounts();
    return accounts.length > 0 ? accounts[0] : null;
  }
}
