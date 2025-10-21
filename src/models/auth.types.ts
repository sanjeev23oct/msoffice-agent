export interface AuthResult {
  accessToken: string;
  account: {
    username: string;
    name: string;
    homeAccountId: string;
  };
  expiresOn: Date;
}

export interface IAuthenticationService {
  initialize(): Promise<void>;
  login(): Promise<AuthResult>;
  logout(): Promise<void>;
  getAccessToken(scopes: string[]): Promise<string>;
  refreshToken(): Promise<string>;
  isAuthenticated(): boolean;
}

export interface AuthConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}
