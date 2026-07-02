export interface ApiResponse<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  meta?: Record<string, unknown>;
}

export function successResponse<T>(
  message: string,
  data?: T,
  meta?: Record<string, unknown>,
): ApiResponse<T> {
  return {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
  };
}

export function errorResponse(message: string, errors?: unknown): ApiResponse {
  return {
    success: false,
    message,
    ...(errors !== undefined && { errors }),
  };
}
