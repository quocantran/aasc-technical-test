/**
 * Standard API response envelope format for consistent REST responses.
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string | null;
  timestamp?: string;
  path?: string;
}
