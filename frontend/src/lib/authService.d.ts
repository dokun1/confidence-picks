// Type declarations for the untyped JS auth service (authService.js).
// tsconfig has strict (noImplicitAny) but not allowJs, so every .ts/.tsx import
// of this module would otherwise resolve to `any` and fail. This .d.ts provides
// real types for the public static API actually consumed by the app and tests.

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  pictureUrl: string | null;
  provider?: string;
}

declare class AuthService {
  static getApiBaseUrl(): string;
  static getToken(): string | null;
  static getRefreshToken(): string | null;
  static setTokens(accessToken: string, refreshToken: string): void;
  static clearTokens(): void;
  static setUser(user: AuthUser): void;
  static getUser(): AuthUser | null;
  static isAuthenticated(): boolean;
  static login(): void;
  static logout(): Promise<void>;
  static makeAuthenticatedRequest(url: string, options?: RequestInit): Promise<Response>;
  static refreshToken(): Promise<string>;
  static getCurrentUser(): Promise<AuthUser | null>;
  static updateUserName(name: string): Promise<AuthUser>;
}

export default AuthService;
