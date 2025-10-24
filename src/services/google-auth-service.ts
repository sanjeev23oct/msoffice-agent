import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import {
  IAuthProvider,
  AuthResult,
  AccountInfo,
  ProviderError,
  ProviderErrorType,
} from '../models/provider.types';

const TOKEN_DIR = path.join(process.env.APPDATA || process.env.HOME || '.', '.outlook-ai-agent');
const TOKEN_FILE = path.join(TOKEN_DIR, 'google-tokens.json');

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleAuthService implements IAuthProvider {
  readonly providerType = 'google' as const;
  readonly accountId: string;

  private oauth2Client: OAuth2Client;
  private config: GoogleAuthConfig;
  private authenticated: boolean = false;
  private accountInfo: AccountInfo | null = null;

  constructor(config: GoogleAuthConfig, accountId?: string) {
    this.config = config;
    this.accountId = accountId || 'google-default';

    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Google Auth Service...');

    // Ensure token directory exists
    if (!fs.existsSync(TOKEN_DIR)) {
      fs.mkdirSync(TOKEN_DIR, { recursive: true });
    }

    // Try to load existing tokens
    if (fs.existsSync(TOKEN_FILE)) {
      try {
        const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
        this.oauth2Client.setCredentials(tokenData);
        this.authenticated = true;

        // Get account info
        await this.loadAccountInfo();

        console.log('✅ Google Auth Service initialized with existing tokens');
      } catch (error) {
        console.error('Error loading tokens:', error);
        this.authenticated = false;
      }
    }
  }

  async login(): Promise<AuthResult> {
    try {
      console.log('🔐 Starting Google OAuth flow...');

      // Generate auth URL
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent', // Force consent screen to get refresh token
      });

      console.log('\n=== Google Authentication ===');
      console.log('Please visit this URL to authorize the application:');
      console.log(authUrl);
      console.log('\nAfter authorization, you will be redirected to a URL like:');
      console.log('http://localhost:3000/auth/google/callback?code=XXXXX');
      console.log('\nThe authentication will complete automatically once you authorize.');
      console.log('================================\n');

      // Return a pending state - the actual token exchange will happen via callback
      return {
        success: false,
        error: 'Please complete authentication in your browser. The URL has been printed to the console.',
      };
    } catch (error: any) {
      throw new ProviderError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'google',
        error,
        `Google authentication failed: ${error.message}`
      );
    }
  }

  async handleAuthCode(code: string): Promise<AuthResult> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Save tokens
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));

      this.authenticated = true;

      // Get account info
      await this.loadAccountInfo();

      console.log('✅ Google authentication successful!');

      return {
        success: true,
        accountInfo: this.accountInfo!,
      };
    } catch (error: any) {
      throw new ProviderError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'google',
        error,
        `Failed to exchange auth code: ${error.message}`
      );
    }
  }

  async logout(): Promise<void> {
    try {
      // Revoke tokens
      if (this.oauth2Client.credentials.access_token) {
        await this.oauth2Client.revokeCredentials();
      }

      // Delete token file
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }

      this.authenticated = false;
      this.accountInfo = null;

      console.log('✅ Logged out from Google');
    } catch (error: any) {
      console.error('Error during logout:', error);
      throw new ProviderError(
        ProviderErrorType.UNKNOWN_ERROR,
        'google',
        error,
        `Logout failed: ${error.message}`
      );
    }
  }

  async getAccessToken(scopes: string[]): Promise<string> {
    if (!this.authenticated) {
      throw new ProviderError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'google',
        null,
        'Not authenticated'
      );
    }

    try {
      // Check if token is expired and refresh if needed
      const tokenInfo = await this.oauth2Client.getTokenInfo(
        this.oauth2Client.credentials.access_token!
      );

      // If token expires in less than 5 minutes, refresh it
      if (tokenInfo.expiry_date && tokenInfo.expiry_date < Date.now() + 5 * 60 * 1000) {
        await this.refreshToken();
      }

      return this.oauth2Client.credentials.access_token!;
    } catch (error: any) {
      // Token might be expired, try to refresh
      try {
        await this.refreshToken();
        return this.oauth2Client.credentials.access_token!;
      } catch (refreshError: any) {
        throw new ProviderError(
          ProviderErrorType.TOKEN_EXPIRED,
          'google',
          refreshError,
          'Failed to get valid access token'
        );
      }
    }
  }

  async refreshToken(): Promise<string> {
    if (!this.oauth2Client.credentials.refresh_token) {
      throw new ProviderError(
        ProviderErrorType.TOKEN_EXPIRED,
        'google',
        null,
        'No refresh token available'
      );
    }

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);

      // Save updated tokens
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(credentials, null, 2));

      console.log('✅ Google access token refreshed');

      return credentials.access_token!;
    } catch (error: any) {
      throw new ProviderError(
        ProviderErrorType.TOKEN_EXPIRED,
        'google',
        error,
        `Token refresh failed: ${error.message}`
      );
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  getAccountInfo(): AccountInfo {
    if (!this.accountInfo) {
      throw new ProviderError(
        ProviderErrorType.AUTHENTICATION_FAILED,
        'google',
        null,
        'Account info not available'
      );
    }
    return this.accountInfo;
  }

  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  private async loadAccountInfo(): Promise<void> {
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();

      this.accountInfo = {
        id: data.id || this.accountId,
        email: data.email || '',
        name: data.name || data.email || 'Google User',
        providerType: 'google',
        avatarUrl: data.picture || undefined,
      };
    } catch (error: any) {
      console.error('Error loading account info:', error);
      throw new ProviderError(
        ProviderErrorType.UNKNOWN_ERROR,
        'google',
        error,
        'Failed to load account info'
      );
    }
  }
}
