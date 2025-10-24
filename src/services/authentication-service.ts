import * as msal from '@azure/msal-node';
import { IAuthenticationService, AuthConfig, AuthResult } from '../models/auth.types';
import { IAuthProvider, AuthResult as ProviderAuthResult, AccountInfo } from '../models/provider.types';
import { TokenStorage } from '../utils/token-storage';

export class AuthenticationService implements IAuthenticationService {
  readonly providerType = 'microsoft' as const;
  readonly accountId: string;

  private msalClient: msal.PublicClientApplication | null = null;
  private tokenStorage: TokenStorage;
  private config: AuthConfig;
  private currentAccount: msal.AccountInfo | null = null;

  constructor(config: AuthConfig, accountId: string = 'microsoft-default') {
    this.config = config;
    this.accountId = accountId;
    this.tokenStorage = new TokenStorage();
  }

  // IAuthProvider adapter - returns this service as an IAuthProvider
  asAuthProvider(): IAuthProvider {
    return {
      providerType: this.providerType,
      accountId: this.accountId,
      initialize: () => this.initialize(),
      login: () => this.loginAsProvider(),
      logout: () => this.logout(),
      getAccessToken: (scopes: string[]) => this.getAccessToken(scopes),
      refreshToken: () => this.refreshToken(),
      isAuthenticated: () => this.isAuthenticated(),
      getAccountInfo: () => this.getAccountInfo(),
    };
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

      if (!response || !response.account) {
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

  // IAuthProvider-compatible login method
  async loginAsProvider(): Promise<ProviderAuthResult> {
    try {
      const result = await this.login();
      
      const accountInfo: AccountInfo = {
        id: result.account.homeAccountId,
        email: result.account.username,
        name: result.account.name,
        providerType: 'microsoft',
      };

      return {
        success: true,
        accountInfo,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Authentication failed. Please try again.',
      };
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

  // IAuthProvider interface methods
  getAccountInfo(): AccountInfo {
    if (!this.currentAccount) {
      throw new Error('Not authenticated');
    }

    return {
      id: this.currentAccount.homeAccountId,
      email: this.currentAccount.username,
      name: this.currentAccount.name || this.currentAccount.username,
      providerType: 'microsoft',
    };
  }
}
