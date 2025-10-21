import { AuthConfig } from '../models/auth.types';

export const authConfig: AuthConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  scopes: [
    'User.Read',
    'Mail.Read',
    'Notes.Read',
    'Calendars.Read',
  ],
};
