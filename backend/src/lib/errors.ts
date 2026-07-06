// ─── Base Error ───────────────────────────────────────

/** Base application error. Marks whether the error is operational (safe to expose) or a programmer bug. */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── HTTP-Specific Errors ────────────────────────────

/** 422 Unprocessable Entity — request body failed validation. */
export class ValidationError extends AppError {
  public readonly errors: unknown;
  constructor(message: string, errors?: unknown) {
    super(message, 422);
    this.errors = errors;
  }
}

/** 404 Not Found — a requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

/** 401 Unauthorized — missing or invalid authentication. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

/** 403 Forbidden — authenticated but insufficient permissions. */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

/** 409 Conflict — resource state conflicts with the request (e.g. duplicate). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** 400 Bad Request — generic client error. */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
