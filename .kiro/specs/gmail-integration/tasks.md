# Gmail Integration - Implementation Plan

This implementation plan breaks down the Gmail integration into discrete, manageable coding tasks. Each task builds incrementally on previous work, following test-driven development principles where appropriate.

## Task List

- [ ] 1. Set up provider abstraction interfaces
  - Create TypeScript interfaces for IAuthProvider, IEmailProvider, ICalendarProvider, and INotesProvider
  - Define common types for AccountInfo, ProviderError, and provider-specific metadata
  - Add providerType and accountId fields to existing Email, Meeting, and Note types
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 2. Install and configure Google API dependencies
  - Add googleapis and google-auth-library packages to package.json
  - Add @types/googleapis for TypeScript support
  - Create .env variables for Google OAuth configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  - Update .env.example with Google configuration template
  - _Requirements: 1.1, 13.2_

- [ ] 3. Implement Google Authentication Service
  - [ ] 3.1 Create GoogleAuthService class implementing IAuthProvider
    - Implement OAuth 2.0 device code flow for desktop authentication
    - Add token storage using OS-level secure storage
    - Implement automatic token refresh logic
    - Add account info retrieval (email, name, avatar)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.3_

  - [ ]* 3.2 Write unit tests for GoogleAuthService
    - Test successful authentication flow
    - Test token refresh logic
    - Test error handling for failed authentication
    - Test token storage and retrieval
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 4. Create Gmail API client wrapper
  - [ ] 4.1 Implement GmailClient class with retry logic
    - Add exponential backoff for rate limiting
    - Implement request queuing
    - Add error normalization to ProviderError types
    - Add logging for debugging
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ]* 4.2 Write unit tests for GmailClient
    - Test retry logic with rate limiting
    - Test error handling and normalization
    - Test request queuing
    - _Requirements: 11.1, 11.2_

- [ ] 5. Implement Gmail Email Service
  - [ ] 5.1 Create GmailEmailService implementing IEmailProvider
    - Implement getRecentEmails using Gmail API
    - Implement getEmailById with caching
    - Implement searchEmails using Gmail query syntax
    - Map Gmail message format to internal Email model
    - Handle Gmail labels and importance markers
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.2 Implement Gmail delta sync using History API
    - Add startMonitoring method with History API polling
    - Implement change detection and callback notifications
    - Add stopMonitoring method
    - Handle Gmail thread grouping
    - _Requirements: 2.6, 6.1_

  - [ ]* 5.3 Write unit tests for GmailEmailService
    - Test email fetching and mapping
    - Test search functionality
    - Test delta sync and change detection
    - Test label mapping
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

- [ ] 6. Implement Google Calendar Service
  - [ ] 6.1 Create GoogleCalendarService implementing ICalendarProvider
    - Implement getUpcomingMeetings using Calendar API
    - Implement getMeetingById with caching
    - Map Google Calendar events to internal Meeting model
    - Handle recurring events and time zones
    - Add support for multiple calendars
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 6.2 Implement findAvailableSlots
    - Query free/busy information from Calendar API
    - Calculate available time slots
    - Handle multiple calendar support
    - _Requirements: 4.4_

  - [ ]* 6.3 Write unit tests for GoogleCalendarService
    - Test meeting fetching and mapping
    - Test recurring event handling
    - Test time zone conversions
    - Test available slot calculation
    - _Requirements: 4.1, 4.2, 4.4_

- [ ] 7. Implement Google Docs/Keep Service
  - [ ] 7.1 Create GoogleDocsService implementing INotesProvider
    - Implement searchNotes using Drive API
    - Implement getNoteContent for Google Docs
    - Map Google Docs to internal Note model
    - Add entity-based search functionality
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.2 Add Google Keep support (if available)
    - Check for Google Keep API availability
    - Implement Keep notes search via Drive API fallback
    - Map Keep notes to internal Note model
    - _Requirements: 5.5_

  - [ ]* 7.3 Write unit tests for GoogleDocsService
    - Test document search
    - Test content extraction
    - Test entity matching
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 8. Refactor existing Microsoft services to implement provider interfaces
  - [ ] 8.1 Update AuthenticationService to implement IAuthProvider
    - Add providerType property ('microsoft')
    - Add accountId property
    - Ensure interface compliance
    - _Requirements: 8.1, 8.2_

  - [ ] 8.2 Update EmailService to implement IEmailProvider
    - Add providerType and accountId properties
    - Ensure interface compliance
    - _Requirements: 8.1, 8.2_

  - [ ] 8.3 Update CalendarService to implement ICalendarProvider
    - Add providerType and accountId properties
    - Ensure interface compliance
    - _Requirements: 8.1, 8.2_

  - [ ] 8.4 Update NotesService to implement INotesProvider
    - Add providerType and accountId properties
    - Ensure interface compliance
    - _Requirements: 8.1, 8.2_

- [ ] 9. Create Provider Manager
  - [ ] 9.1 Implement ProviderManager class
    - Add account management methods (addAccount, removeAccount, getAccounts)
    - Implement provider instance creation and caching
    - Add methods to get provider instances by accountId
    - Implement unified operations (getAllRecentEmails, getAllUpcomingMeetings, etc.)
    - Add error handling and provider failover logic
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 8.2, 8.3_

  - [ ]* 9.2 Write unit tests for ProviderManager
    - Test account management
    - Test provider instance creation
    - Test unified operations across multiple providers
    - Test error handling
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3_

- [ ] 10. Update Storage Service for multi-provider support
  - [ ] 10.1 Update database schema
    - Add provider_type and account_id columns to emails table
    - Add provider_type and account_id columns to meetings table
    - Add provider_type and account_id columns to notes table
    - Create accounts table with id, provider_type, email, name, avatar_url, created_at, last_sync
    - Write migration script
    - _Requirements: 6.1, 6.3, 10.1_

  - [ ] 10.2 Update StorageService methods
    - Update saveEmail to include provider_type and account_id
    - Update saveMeeting to include provider_type and account_id
    - Update saveNote to include provider_type and account_id
    - Add account management methods (saveAccount, getAccounts, deleteAccount)
    - Update query methods to support filtering by account
    - _Requirements: 6.1, 6.3, 10.4_

  - [ ]* 10.3 Write unit tests for updated StorageService
    - Test multi-provider data storage
    - Test account management
    - Test filtering by account
    - _Requirements: 6.1, 6.3_

- [ ] 11. Update Agent Core for multi-provider support
  - [ ] 11.1 Refactor AgentCore to use ProviderManager
    - Replace direct service dependencies with ProviderManager
    - Update email analysis to work with multiple accounts
    - Update meeting brief generation to include all accounts
    - Update note linking to search across all providers
    - Add account context to all operations
    - _Requirements: 7.1, 7.2, 7.3, 8.3, 9.1_

  - [ ] 11.2 Update priority classification for Gmail
    - Extend email analysis to consider Gmail labels
    - Map Gmail importance markers to priority scores
    - Ensure consistent priority classification across providers
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 11.3 Write integration tests for multi-provider agent operations
    - Test email analysis across providers
    - Test meeting brief generation with multiple calendars
    - Test note linking across OneNote and Google Docs
    - _Requirements: 7.1, 7.2, 7.3, 9.1_

- [ ] 12. Create UI components for account management
  - [ ] 12.1 Create AccountSelector component
    - Build dropdown to select/filter by account
    - Add "All Accounts" option
    - Show account email and provider icon
    - Persist selected account in local storage
    - _Requirements: 6.4, 7.4_

  - [ ] 12.2 Create AccountBadge component
    - Display provider icon (Gmail/Outlook)
    - Show account email on hover
    - Add to email list items
    - Add to meeting list items
    - _Requirements: 7.5_

  - [ ] 12.3 Create AddAccountButton component
    - Add button in settings/header
    - Show modal with provider selection (Gmail/Outlook)
    - Trigger OAuth flow on selection
    - Show success/error messages
    - _Requirements: 6.1, 14.2, 14.3_

  - [ ] 12.4 Create AccountManagement component
    - List all connected accounts
    - Show account details (email, name, provider, last sync)
    - Add "Remove Account" button for each account
    - Add "Add Account" button
    - Show sync status and errors
    - _Requirements: 6.2, 14.1_

- [ ] 13. Update Dashboard component
  - [ ] 13.1 Integrate AccountSelector into Dashboard
    - Add AccountSelector to header
    - Filter displayed emails by selected account
    - Filter displayed meetings by selected account
    - Update counts and statistics
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 13.2 Update email list to show account badges
    - Add AccountBadge to each email item
    - Update styling for multi-account view
    - Add account grouping option
    - _Requirements: 7.5_

  - [ ] 13.3 Update meeting list to show account badges
    - Add AccountBadge to each meeting item
    - Show calendar source
    - Handle cross-provider meeting attendees
    - _Requirements: 7.5, 4.3_

- [ ] 14. Implement error handling and user feedback
  - [ ] 14.1 Create error notification system
    - Add toast notifications for errors
    - Show user-friendly error messages
    - Add retry buttons for recoverable errors
    - Add "Re-authenticate" button for auth errors
    - _Requirements: 11.2, 11.3, 11.4_

  - [ ] 14.2 Add loading states
    - Show loading spinner during OAuth flow
    - Show sync progress for initial account setup
    - Add skeleton loaders for email/meeting lists
    - _Requirements: 14.4_

  - [ ] 14.3 Implement graceful degradation
    - Fall back to cached data when API unavailable
    - Show offline indicator
    - Queue operations for retry when online
    - _Requirements: 11.2, 11.5_

- [ ] 15. Add configuration and feature flags
  - [ ] 15.1 Create configuration service
    - Load Google OAuth config from environment
    - Add feature flags for Gmail, Google Calendar, Google Docs
    - Add sync interval configuration
    - Validate configuration on startup
    - _Requirements: 1.1, 13.2_

  - [ ] 15.2 Update main process to handle Google OAuth
    - Add OAuth callback handler
    - Implement deep linking for OAuth redirect
    - Handle OAuth errors
    - _Requirements: 1.1, 1.4_

- [ ] 16. Implement onboarding flow for Gmail
  - [ ] 16.1 Create Gmail onboarding wizard
    - Add welcome screen explaining Gmail integration
    - Show required permissions and why they're needed
    - Guide user through OAuth flow
    - Show initial sync progress
    - Display success screen with next steps
    - _Requirements: 14.2, 14.3, 14.4, 14.5_

  - [ ] 16.2 Update first-run experience
    - Add provider selection (Gmail, Outlook, or both)
    - Allow skipping and adding accounts later
    - Preserve existing Outlook setup for current users
    - _Requirements: 14.1, 14.2_

- [ ] 17. Add search improvements for multi-provider
  - [ ] 17.1 Implement unified search
    - Search across all connected accounts
    - Aggregate results from multiple providers
    - Sort by relevance and date
    - Show account source in results
    - _Requirements: 7.3_

  - [ ] 17.2 Add provider-specific search syntax
    - Support Gmail query syntax for Gmail accounts
    - Support OData filters for Outlook accounts
    - Add syntax help/documentation
    - _Requirements: 2.3_

- [ ] 18. Implement data privacy and security features
  - [ ] 18.1 Add secure token storage
    - Use OS keychain for token storage
    - Encrypt sensitive data at rest
    - Clear tokens on logout
    - _Requirements: 10.1, 10.3_

  - [ ] 18.2 Implement data deletion
    - Add "Delete Account Data" option
    - Clear all cached emails, meetings, notes for account
    - Remove account from database
    - Revoke OAuth tokens
    - _Requirements: 10.4_

  - [ ] 18.3 Add privacy controls
    - Allow users to control what data is sent to AI
    - Add option to process emails locally only
    - Show data usage transparency
    - _Requirements: 10.2, 10.3_

- [ ] 19. Performance optimization
  - [ ] 19.1 Implement request batching
    - Batch Gmail API requests where possible
    - Batch Google Calendar API requests
    - Reduce API call overhead
    - _Requirements: 11.1_

  - [ ] 19.2 Optimize caching strategy
    - Implement intelligent cache invalidation
    - Add cache warming for frequently accessed data
    - Set appropriate TTLs for different data types
    - Monitor cache hit rates
    - _Requirements: 2.5_

  - [ ] 19.3 Add lazy loading
    - Load email bodies on demand
    - Paginate large result sets
    - Defer loading of attachments
    - Implement virtual scrolling for long lists
    - _Requirements: 2.2_

- [ ] 20. Documentation and final polish
  - [ ] 20.1 Create user documentation
    - Write Gmail setup guide
    - Document multi-account features
    - Add troubleshooting section
    - Create FAQ
    - _Requirements: 14.3_

  - [ ] 20.2 Create developer documentation
    - Document provider abstraction architecture
    - Add API documentation for new services
    - Create contribution guide for adding new providers
    - Document configuration options
    - _Requirements: 8.1, 8.2_

  - [ ] 20.3 Prepare for Google OAuth verification
    - Create privacy policy
    - Create terms of service
    - Record demo video of OAuth flow
    - Prepare security documentation
    - Submit verification request
    - _Requirements: 13.1, 13.2, 13.3_

