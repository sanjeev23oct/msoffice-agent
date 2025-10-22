// Provider abstraction interfaces for multi-provider support (Outlook, Gmail, etc.)

export type ProviderType = 'microsoft' | 'google';

export interface AccountInfo {
  id: string;
  email: string;
  name: string;
  providerType: ProviderType;
  avatarUrl?: string;
}

export enum ProviderErrorType {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class ProviderError extends Error {
  constructor(
    public type: ProviderErrorType,
    public providerType: ProviderType,
    public originalError: any,
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// Authentication Provider Interface
export interface IAuthProvider {
  readonly providerType: ProviderType;
  readonly accountId: string;

  initialize(): Promise<void>;
  login(): Promise<AuthResult>;
  logout(): Promise<void>;
  getAccessToken(scopes: string[]): Promise<string>;
  refreshToken(): Promise<string>;
  isAuthenticated(): boolean;
  getAccountInfo(): AccountInfo;
}

export interface AuthResult {
  success: boolean;
  accountInfo?: AccountInfo;
  error?: string;
}

// Email Provider Interface
export interface IEmailProvider {
  readonly providerType: ProviderType;
  readonly accountId: string;

  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getRecentEmails(count: number): Promise<EmailWithProvider[]>;
  getEmailById(id: string): Promise<EmailWithProvider>;
  searchEmails(query: string): Promise<EmailWithProvider[]>;
  subscribeToChanges(callback: (email: EmailWithProvider) => void): void;
  clearCache(): void;
}

// Calendar Provider Interface
export interface ICalendarProvider {
  readonly providerType: ProviderType;
  readonly accountId: string;

  getUpcomingMeetings(days: number): Promise<MeetingWithProvider[]>;
  getMeetingById(id: string): Promise<MeetingWithProvider>;
  findAvailableSlots(duration: number, days: number): Promise<TimeSlot[]>;
  getMeetingAttendees(meetingId: string): Promise<Attendee[]>;
  clearCache(): void;
}

// Notes Provider Interface
export interface INotesProvider {
  readonly providerType: ProviderType;
  readonly accountId: string;

  getNotebooks(): Promise<Notebook[]>;
  searchNotes(query: string): Promise<NoteWithProvider[]>;
  getNoteContent(noteId: string): Promise<NoteContent>;
  findNotesByEntity(entityName: string, entityType: string): Promise<NoteWithProvider[]>;
  clearCache(): void;
}

// Extended types with provider information
export interface EmailWithProvider {
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

  // Provider-specific fields
  providerType: ProviderType;
  accountId: string;
  accountEmail: string;

  // Provider-specific metadata
  metadata?: {
    labels?: string[]; // Gmail labels
    threadId?: string; // Gmail thread ID
    categories?: string[]; // Outlook categories
  };
}

export interface MeetingWithProvider {
  id: string;
  subject: string;
  start: Date;
  end: Date;
  location?: string;
  organizer: EmailAddress;
  attendees: Attendee[];
  body: string;
  isOnlineMeeting: boolean;
  onlineMeetingUrl?: string;

  // Provider-specific fields
  providerType: ProviderType;
  accountId: string;
  accountEmail: string;

  // Provider-specific metadata
  metadata?: {
    calendarId?: string; // Google Calendar ID
    recurringEventId?: string; // Google recurring event
    conferenceData?: any; // Google Meet info
  };
}

export interface NoteWithProvider {
  id: string;
  title: string;
  content: string;
  createdDateTime: Date;
  lastModifiedDateTime: Date;
  sectionId: string;
  notebookId: string;
  tags: string[];

  // Provider-specific fields
  providerType: ProviderType;
  accountId: string;
  accountEmail: string;

  // Provider-specific metadata
  metadata?: {
    documentId?: string; // Google Docs ID
    mimeType?: string; // Google Drive MIME type
    notebookName?: string; // Notebook name
    sectionName?: string; // Section name
  };
}

// Supporting types
export interface EmailAddress {
  name: string;
  address: string;
}

export interface Attendee {
  emailAddress: EmailAddress;
  type: 'required' | 'optional' | 'resource';
  status: 'none' | 'accepted' | 'declined' | 'tentative';
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface Notebook {
  id: string;
  displayName: string;
  sections: Section[];
}

export interface Section {
  id: string;
  displayName: string;
  parentNotebookId: string;
}

export interface NoteContent {
  html: string;
  plainText: string;
  images: Image[];
}

export interface Image {
  url: string;
  alt?: string;
}
