import * as msal from '@azure/msal-node';
import { IAuthenticationService, AuthResult, AuthConfig } from '../models/auth.types';
import { TokenStorage } from '../utils/token-storage';

export class AuthenticationService implements IAuthenticationService {
  private msalClient: msal.PublicClientApplication | null = null;
  private tokenStorage: TokenStorage;
  private config: AuthConfig;
  private currentAccount: msal.AccountInfo | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
    this.tokenStorage = new TokenStorage();
  }

  async initialize(): Promise<void> {
    const msalConfig: msal.Configuration = {
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
      },
      cache: {
        cachePlugin: {
          beforeCacheAccess: async (cacheContext) => {
            const tokens = this.tokenStorage.loadTokens();
            if (tokens) {
              cacheContext.tokenCache.deserialize(tokens);
            }
          },
          afterCacheAccess: async (cacheContext) => {
            if (cacheContext.cacheHasChanged) {
              const tokens = cacheContext.tokenCache.serialize();
              this.tokenStorage.saveTokens(tokens);
            }
          },
        },
      },
    };

    this.msalClient = new msal.PublicClientApplication(msalConfig);

    // Try to load existing account
    const accounts = await this.msalClient.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      this.currentAccount = accounts[0];
    }
  }

  async login(): Promise<AuthResult> {
    if (!this.msalClient) {
      throw new Error('Authentication service not initialized');
    }

    try {
      // Use device code flow for desktop apps
      const deviceCodeRequest: msal.DeviceCodeRequest = {
        deviceCodeCallback: (response) => {
          console.log('\n=== Microsoft Authentication ===');
          console.log(response.message);
          console.log('================================\n');
        },
        scopes: this.config.scopes,
      };

      const response = await this.msalClient.acquireTokenByDeviceCode(deviceCodeRequest);

      if (!response) {
        throw new Error('Failed to acquire token');
      }

      this.currentAccount = response.account;

      return {
        accessToken: response.accessToken,
        account: {
          username: response.account.username,
          name: response.account.name || response.account.username,
          homeAccountId: response.account.homeAccountId,
        },
        expiresOn: response.expiresOn || new Date(),
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Authentication failed. Please try again.');
    }
  }

  async logout(): Promise<void> {
    this.currentAccount = null;
    this.tokenStorage.clearTokens();
    
    if (this.msalClient) {
      const accounts = await this.msalClient.getTokenCache().getAllAccounts();
      for (const account of accounts) {
        await this.msalClient.getTokenCache().removeAccount(account);
      }
    }
  }

  async getAccessToken(scopes: string[]): Promise<string> {
    if (!this.msalClient || !this.currentAccount) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      // Try silent token acquisition first
      const silentRequest: msal.SilentFlowRequest = {
        account: this.currentAccount,
        scopes: scopes,
      };

      const response = await this.msalClient.acquireTokenSilent(silentRequest);
      return response.accessToken;
    } catch (error) {
      // If silent acquisition fails, try to refresh
      console.log('Silent token acquisition failed, attempting refresh...');
      return this.refreshToken();
    }
  }

  async refreshToken(): Promise<string> {
    if (!this.msalClient || !this.currentAccount) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const silentRequest: msal.SilentFlowRequest = {
        account: this.currentAccount,
        scopes: this.config.scopes,
        forceRefresh: true,
      };

      const response = await this.msalClient.acquireTokenSilent(silentRequest);
      return response.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error('Token refresh failed. Please login again.');
    }
  }

  isAuthenticated(): boolean {
    return this.currentAccount !== null;
  }
}
