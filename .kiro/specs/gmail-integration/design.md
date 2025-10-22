# Gmail Integration - Design Document

## Overview

This design document outlines the architecture for integrating Gmail, Google Calendar, and Google Workspace (Docs/Keep) into the existing Outlook-OneNote AI Agent. The design follows a provider abstraction pattern that allows the application to work seamlessly with both Microsoft and Google services while maintaining a unified user experience.

The key design principle is to create provider-agnostic interfaces that abstract away the differences between Microsoft Graph API and Google APIs, allowing the core agent logic to remain unchanged while supporting multiple email providers.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Application Core / Agent                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Provider Abstraction Layer                     │ │
│  │  ┌──────────────────┐    ┌──────────────────┐         │ │
│  │  │ IEmailProvider   │    │ ICalendarProvider│         │ │
│  │  │ INotesProvider   │    │ IAuthProvider    │         │ │
│  │  └──────────────────┘    └──────────────────┘         │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌─────────────────┐              ┌─────────────────┐      │
│  │   Microsoft     │              │     Google      │      │
│  │   Providers     │              │    Providers    │      │
│  │                 │              │                 │      │
│  │ • GraphClient   │              │ • GmailClient   │      │
│  │ • MSAuth        │              │ • GoogleAuth    │      │
│  │ • OutlookEmail  │              │ • GmailEmail    │      │
│  │ • MSCalendar    │              │ • GoogleCal     │      │
│  │ • OneNote       │              │ • GoogleDocs    │      │
│  └─────────────────┘              └─────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │   External APIs                        │
        │  • Microsoft Graph API                 │
        │  • Gmail API                           │
        │  • Google Calendar API                 │
        │  • Google Docs API                     │
        │  • Google Keep API (if available)      │
        └───────────────────────────────────────┘
```

### Provider Abstraction Pattern

The design introduces a provider abstraction layer that defines common interfaces for all email/calendar/notes operations. This allows:

1. **Unified Agent Logic**: The AI agent and core services work with abstract interfaces, not specific providers
2. **Easy Provider Addition**: New providers can be added by implementing the interfaces
3. **Multi-Account Support**: Multiple instances of providers can coexist for different accounts
4. **Consistent Error Handling**: Provider-specific errors are normalized to common error types

## Components and Interfaces

### 1. Provider Interfaces

#### IAuthProvider

```typescript
interface IAuthProvider {
  readonly providerType: 'microsoft' | 'google';
  readonly accountId: string;
  
  initialize(): Promise<void>;
  login(): Promise<AuthResult>;
  logout(): Promise<void>;
  getAccessToken(scopes: string[]): Promise<string>;
  refreshToken(): Promise<string>;
  isAuthenticated(): boolean;
  getAccountInfo(): AccountInfo;
}

interface AccountInfo {
  id: string;
  email: string;
  name: string;
  providerType: 'microsoft' | 'google';
  avatarUrl?: string;
}
```

#### IEmailProvider

```typescript
interface IEmailProvider {
  readonly providerType: 'microsoft' | 'google';
  readonly accountId: string;
  
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getRecentEmails(count: number): Promise<Email[]>;
  getEmailById(id: string): Promise<Email>;
  searchEmails(query: string): Promise<Email[]>;
  subscribeToChanges(callback: (email: Email) => void): void;
  clearCache(): void;
}
```

#### ICalendarProvider

```typescript
interface ICalendarProvider {
  readonly providerType: 'microsoft' | 'google';
  readonly accountId: string;
  
  getUpcomingMeetings(days: number): Promise<Meeting[]>;
  getMeetingById(id: string): Promise<Meeting>;
  findAvailableSlots(duration: number, days: number): Promise<TimeSlot[]>;
  getMeetingAttendees(meetingId: string): Promise<Attendee[]>;
  clearCache(): void;
}
```

#### INotesProvider

```typescript
interface INotesProvider {
  readonly providerType: 'microsoft' | 'google';
  readonly accountId: string;
  
  getNotebooks(): Promise<Notebook[]>;
  searchNotes(query: string): Promise<Note[]>;
  getNoteContent(noteId: string): Promise<NoteContent>;
  findNotesByEntity(entityName: string, entityType: string): Promise<Note[]>;
  clearCache(): void;
}
```

### 2. Google Authentication Service

**File**: `src/services/google-auth-service.ts`

Implements `IAuthProvider` for Google OAuth 2.0 using the `googleapis` library.

**Key Features**:
- OAuth 2.0 device code flow for desktop apps
- Secure token storage using OS keychain
- Automatic token refresh
- Support for multiple Google accounts

**Dependencies**:
- `googleapis` - Official Google API client
- `google-auth-library` - OAuth 2.0 client

**Scopes Required**:
```typescript
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];
```

### 3. Gmail Client

**File**: `src/services/gmail-client.ts`

Wrapper around Gmail API that provides retry logic, rate limiting, and error handling.

**Key Features**:
- Exponential backoff for rate limiting
- Request batching for efficiency
- Connection pooling
- Detailed logging for debugging

### 4. Gmail Email Service

**File**: `src/services/gmail-email-service.ts`

Implements `IEmailProvider` for Gmail.

**Key Features**:
- Email fetching using Gmail API
- Delta sync using Gmail History API for efficient change detection
- Label mapping (Gmail labels → internal categories)
- Thread support (Gmail threads → conversation grouping)
- Attachment handling
- Search using Gmail query syntax

**Gmail-Specific Mappings**:
- Gmail labels → Email categories
- Gmail importance markers → Priority classification
- Gmail threads → Conversation IDs

### 5. Google Calendar Service

**File**: `src/services/google-calendar-service.ts`

Implements `ICalendarProvider` for Google Calendar.

**Key Features**:
- Event fetching using Google Calendar API
- Multiple calendar support
- Recurring event handling
- Time zone management
- Free/busy information

### 6. Google Docs/Keep Service

**File**: `src/services/google-docs-service.ts`

Implements `INotesProvider` for Google Docs and Google Keep.

**Key Features**:
- Search across Google Docs
- Document content extraction
- Google Keep notes (if API available, otherwise use Drive API)
- Link detection and entity matching

**Note**: Google Keep doesn't have an official public API. We'll use Google Drive API to access Keep notes stored in Drive, or wait for official API access.

### 7. Provider Manager

**File**: `src/services/provider-manager.ts`

Central service that manages all provider instances and provides a unified interface to the application.

**Responsibilities**:
- Create and manage provider instances
- Handle multi-account scenarios
- Route operations to correct provider
- Aggregate results from multiple providers
- Handle provider-specific errors

**Key Methods**:
```typescript
class ProviderManager {
  // Account management
  addAccount(providerType: 'microsoft' | 'google'): Promise<string>;
  removeAccount(accountId: string): Promise<void>;
  getAccounts(): AccountInfo[];
  
  // Provider access
  getEmailProvider(accountId: string): IEmailProvider;
  getCalendarProvider(accountId: string): ICalendarProvider;
  getNotesProvider(accountId: string): INotesProvider;
  
  // Unified operations
  getAllRecentEmails(count: number): Promise<EmailWithAccount[]>;
  getAllUpcomingMeetings(days: number): Promise<MeetingWithAccount[]>;
  searchAllEmails(query: string): Promise<EmailWithAccount[]>;
  searchAllNotes(query: string): Promise<NoteWithAccount[]>;
}
```

### 8. Updated Agent Core

**File**: `src/services/agent-core.ts` (modified)

The agent core will be updated to work with the `ProviderManager` instead of directly with Microsoft services.

**Changes**:
- Replace direct service dependencies with `ProviderManager`
- Update methods to handle multi-account scenarios
- Add account context to all operations
- Handle provider-specific features gracefully

### 9. Storage Service Updates

**File**: `src/services/storage-service.ts` (modified)

Update the storage service to handle multi-provider data.

**Schema Changes**:
```sql
-- Add provider_type and account_id columns
ALTER TABLE emails ADD COLUMN provider_type TEXT;
ALTER TABLE emails ADD COLUMN account_id TEXT;

ALTER TABLE meetings ADD COLUMN provider_type TEXT;
ALTER TABLE meetings ADD COLUMN account_id TEXT;

ALTER TABLE notes ADD COLUMN provider_type TEXT;
ALTER TABLE notes ADD COLUMN account_id TEXT;

-- Add accounts table
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  last_sync INTEGER
);
```

### 10. UI Updates

**Files**: 
- `src/renderer/components/AccountSelector.tsx` (new)
- `src/renderer/components/Dashboard.tsx` (modified)
- `src/renderer/components/EmailList.tsx` (modified)

**New Components**:
- **AccountSelector**: Dropdown to select/filter by account
- **AccountBadge**: Visual indicator showing email/meeting source
- **AddAccountButton**: Button to add new Gmail/Outlook accounts

**UI Changes**:
- Add account badges to email/meeting items
- Add account filter dropdown
- Add "Add Account" button in settings
- Show provider icons (Gmail/Outlook) next to items

## Data Models

### Extended Email Model

```typescript
interface EmailWithAccount extends Email {
  providerType: 'microsoft' | 'google';
  accountId: string;
  accountEmail: string;
  
  // Provider-specific metadata
  metadata?: {
    labels?: string[]; // Gmail labels
    threadId?: string; // Gmail thread ID
    categories?: string[]; // Outlook categories
  };
}
```

### Extended Meeting Model

```typescript
interface MeetingWithAccount extends Meeting {
  providerType: 'microsoft' | 'google';
  accountId: string;
  accountEmail: string;
  
  // Provider-specific metadata
  metadata?: {
    calendarId?: string; // Google Calendar ID
    recurringEventId?: string; // Google recurring event
    conferenceData?: any; // Google Meet info
  };
}
```

### Extended Note Model

```typescript
interface NoteWithAccount extends Note {
  providerType: 'microsoft' | 'google';
  accountId: string;
  accountEmail: string;
  
  // Provider-specific metadata
  metadata?: {
    documentId?: string; // Google Docs ID
    mimeType?: string; // Google Drive MIME type
    notebookId?: string; // OneNote notebook
  };
}
```

## Error Handling

### Normalized Error Types

```typescript
enum ProviderErrorType {
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

class ProviderError extends Error {
  constructor(
    public type: ProviderErrorType,
    public providerType: 'microsoft' | 'google',
    public originalError: any,
    message: string
  ) {
    super(message);
  }
}
```

### Error Handling Strategy

1. **Authentication Errors**: Prompt user to re-authenticate
2. **Rate Limiting**: Implement exponential backoff and queue requests
3. **Quota Exceeded**: Show user-friendly message with suggestions
4. **Network Errors**: Fall back to cached data, retry with backoff
5. **Permission Denied**: Show clear message about required permissions

### Retry Logic

```typescript
class RetryHandler {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries: number;
      backoffMs: number;
      retryableErrors: ProviderErrorType[];
    }
  ): Promise<T>;
}
```

## Testing Strategy

### Unit Tests

**Test Files**:
- `src/services/__tests__/google-auth-service.test.ts`
- `src/services/__tests__/gmail-email-service.test.ts`
- `src/services/__tests__/google-calendar-service.test.ts`
- `src/services/__tests__/provider-manager.test.ts`

**Test Coverage**:
- Authentication flow (success/failure)
- Token refresh logic
- Email fetching and mapping
- Calendar event retrieval
- Error handling and retries
- Multi-account scenarios

### Integration Tests

**Test Scenarios**:
- End-to-end OAuth flow
- Email sync with Gmail API
- Calendar sync with Google Calendar API
- Multi-provider data aggregation
- Provider failover scenarios

### Manual Testing Checklist

- [ ] Google OAuth flow completes successfully
- [ ] Gmail emails display correctly
- [ ] Google Calendar events show up
- [ ] Multi-account switching works
- [ ] Unified inbox shows both Gmail and Outlook
- [ ] Search works across providers
- [ ] Priority classification works for Gmail
- [ ] Meeting briefs include Google Calendar events
- [ ] Error messages are user-friendly
- [ ] Token refresh happens automatically

## Security Considerations

### Token Storage

- Use OS-level secure storage (Keychain on macOS, Credential Manager on Windows)
- Encrypt tokens at rest
- Never log tokens or sensitive data
- Clear tokens on logout

### API Security

- Use HTTPS for all API calls
- Validate SSL certificates
- Implement CSRF protection for OAuth
- Use state parameter in OAuth flow
- Validate redirect URIs

### Data Privacy

- Process emails locally where possible
- Only send necessary data to AI services
- Implement data retention policies
- Allow users to delete cached data
- Comply with GDPR/CCPA

### Google OAuth Verification

To publish the app with Gmail access, we need Google OAuth verification:

**Requirements**:
1. Privacy Policy URL
2. Terms of Service URL
3. Application homepage
4. Authorized domains
5. Demo video showing OAuth flow
6. Justification for each scope requested

**Verification Process**:
1. Submit app for verification
2. Security assessment by Google
3. Address any findings
4. Receive verification (2-6 weeks)

### CASA Tier 2 Certification (Future)

For enterprise customers, pursue CASA Tier 2:

**Requirements**:
- Independent security assessment
- Penetration testing
- Vulnerability management
- Incident response plan
- Regular security audits

## Performance Optimization

### Caching Strategy

- Cache emails, meetings, and notes locally
- Use delta sync for incremental updates
- Implement cache invalidation policies
- Set appropriate TTLs for different data types

### Rate Limiting

- Implement request queuing
- Use exponential backoff
- Batch requests where possible
- Monitor API quota usage

### Lazy Loading

- Load emails on demand
- Paginate large result sets
- Defer loading of email bodies
- Load attachments only when needed

## Migration Path

### Phase 1: Core Infrastructure (Week 1-2)

1. Add googleapis dependencies
2. Create provider interfaces
3. Implement Google authentication
4. Create Gmail client wrapper

### Phase 2: Gmail Integration (Week 3-4)

1. Implement Gmail email service
2. Add email sync functionality
3. Update storage schema
4. Test multi-account support

### Phase 3: Calendar & Docs (Week 5-6)

1. Implement Google Calendar service
2. Implement Google Docs service
3. Update provider manager
4. Test unified operations

### Phase 4: UI Updates (Week 7-8)

1. Add account selector
2. Add account badges
3. Update dashboard
4. Add account management UI

### Phase 5: Testing & Polish (Week 9-10)

1. Comprehensive testing
2. Performance optimization
3. Error handling improvements
4. Documentation

### Phase 6: OAuth Verification (Week 11-12)

1. Prepare verification materials
2. Submit for Google OAuth verification
3. Address feedback
4. Launch with verified status

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "googleapis": "^128.0.0",
    "google-auth-library": "^9.0.0"
  },
  "devDependencies": {
    "@types/googleapis": "^1.0.0"
  }
}
```

### API Quotas

**Gmail API**:
- 1 billion quota units per day
- Most operations cost 5-25 units
- Monitor usage to avoid hitting limits

**Google Calendar API**:
- 1 million queries per day
- 10,000 queries per 100 seconds per user

**Google Drive API** (for Docs/Keep):
- 20,000 queries per 100 seconds per user
- 1 billion queries per day

## Configuration

### Environment Variables

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Feature Flags
ENABLE_GMAIL=true
ENABLE_GOOGLE_CALENDAR=true
ENABLE_GOOGLE_DOCS=true
ENABLE_GOOGLE_KEEP=false  # Not available yet

# API Settings
GMAIL_SYNC_INTERVAL=30000  # 30 seconds
GOOGLE_CALENDAR_SYNC_INTERVAL=60000  # 1 minute
```

### Google Cloud Console Setup

1. Create new project in Google Cloud Console
2. Enable APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - Google People API (for profile info)
3. Create OAuth 2.0 credentials
4. Configure OAuth consent screen
5. Add test users (during development)
6. Submit for verification (before production)

## Rollout Strategy

### Beta Testing

1. Internal testing with team accounts
2. Limited beta with 10-20 users
3. Gather feedback and iterate
4. Expand beta to 100+ users

### Gradual Rollout

1. Launch with "Add Gmail Account" feature flag
2. Monitor error rates and performance
3. Gradually enable for all users
4. Announce Gmail support publicly

### Success Metrics

- Number of Gmail accounts connected
- Gmail email sync success rate
- User engagement with Gmail features
- Error rates and support tickets
- Performance metrics (latency, memory)

## Future Enhancements

### Phase 2 Features

1. **Gmail Send**: Allow sending emails through Gmail
2. **Calendar Write**: Create/update Google Calendar events
3. **Google Keep**: Full integration when API available
4. **Google Tasks**: Integrate task management
5. **Google Contacts**: Use for entity recognition

### Advanced Features

1. **Smart Compose**: AI-powered email composition
2. **Auto-categorization**: ML-based email categorization
3. **Cross-provider Search**: Unified search across all accounts
4. **Conversation Threading**: Link related emails across providers
5. **Meeting Scheduling**: AI-powered meeting scheduling across calendars

## Appendix

### Gmail API Query Syntax

Gmail uses a powerful query syntax for searching:

```
from:user@example.com
to:user@example.com
subject:meeting
has:attachment
is:unread
is:important
is:starred
after:2024/01/01
before:2024/12/31
label:important
```

### Google Calendar API Event Types

- Single events
- Recurring events
- All-day events
- Multi-day events
- Events with Google Meet
- Events with attachments

### Comparison: Microsoft Graph vs Google APIs

| Feature | Microsoft Graph | Google APIs |
|---------|----------------|-------------|
| Authentication | MSAL | OAuth 2.0 |
| Email API | Unified Graph API | Gmail API |
| Calendar API | Unified Graph API | Calendar API |
| Notes API | OneNote API | Drive API (Docs) |
| Query Language | OData filters | Gmail query syntax |
| Delta Sync | Delta queries | History API |
| Batch Requests | $batch endpoint | Batch API |
| Rate Limiting | Per-app throttling | Quota units |

