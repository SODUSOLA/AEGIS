/** Standard envelope for every API response. */
export interface ApiResponse<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  meta?: Record<string, unknown>;
}

/** Builds a success envelope. Omits `data` when undefined to keep the payload clean. */
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

/** Builds an error envelope with optional structured error details. */
export function errorResponse(message: string, errors?: unknown): ApiResponse {
  return {
    success: false,
    message,
    ...(errors !== undefined && { errors }),
  };
}
