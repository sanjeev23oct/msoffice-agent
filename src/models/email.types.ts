export interface EmailAddress {
  name: string;
  address: string;
}

export interface Email {
  id: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  body: string;
  receivedDateTime: Date;
  hasAttachments: boolean;
  importance: 'low' | 'normal' | 'high';
  isRead: boolean;
  conversationId: string;
}

export interface IEmailService {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getRecentEmails(count: number): Promise<Email[]>;
  getEmailById(id: string): Promise<Email>;
  searchEmails(query: string): Promise<Email[]>;
  subscribeToChanges(callback: (email: Email) => void): void;
}
