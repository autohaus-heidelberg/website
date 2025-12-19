import { api } from './api'

export interface LoginCredentials {
  username: string
  password: string
}

export interface TokenResponse {
  access: string
  refresh: string
}

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  groups: string[]
}

export const authService = {
  /**
   * Login with username and password
   * Returns JWT tokens
   */
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    return api.publicPost<TokenResponse>('/api/token/', credentials)
  },

  /**
   * Refresh the access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return api.publicPost<TokenResponse>('/api/token/refresh/', { refresh: refreshToken })
  },

  /**
   * Verify if a token is valid
   */
  async verifyToken(token: string): Promise<void> {
    await api.publicPost('/api/token/verify/', { token })
  },

  /**
   * Get current authenticated user information
   */
  async getCurrentUser(): Promise<User> {
    return api.get<User>('/api/user/')
  },

  /**
   * Logout - clear tokens from localStorage
   */
  logout(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token')
  },

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token')
  },

  /**
   * Get stored refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token')
  },

  /**
   * Store tokens in localStorage
   */
  storeTokens(tokens: TokenResponse): void {
    localStorage.setItem('access_token', tokens.access)
    localStorage.setItem('refresh_token', tokens.refresh)
  },
}
