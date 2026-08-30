/**
 * Data structures for OAuth token storage and renewal responses.
 */
export interface SaveTokenDto {
  domain?: string;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  expiresAt?: number;
  memberId?: string;
  scope?: string;
}

export interface BitrixOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires?: number;
  expires_in?: number;
  scope?: string;
  domain?: string;
  server_endpoint?: string;
  client_endpoint?: string;
  member_id?: string;
  user_id?: number;
  status?: string;
  error?: string;
  error_description?: string;
}
