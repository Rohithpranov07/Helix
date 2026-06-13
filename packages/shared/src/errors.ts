export class HelixError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "HelixError";
    this.code = code;
  }
}

export class VerificationError extends HelixError {
  constructor(message: string) {
    super(message, "VERIFICATION_FAILED");
    this.name = "VerificationError";
  }
}

export class AuthorizationError extends HelixError {
  constructor(message: string) {
    super(message, "AUTHORIZATION_DENIED");
    this.name = "AuthorizationError";
  }
}

export class ExternalApiError extends HelixError {
  readonly provider: string;
  readonly statusCode?: number;

  constructor(message: string, provider: string, statusCode?: number) {
    super(message, "EXTERNAL_API_ERROR");
    this.name = "ExternalApiError";
    this.provider = provider;
    if (statusCode !== undefined) this.statusCode = statusCode;
  }
}

export class ValidationError extends HelixError {
  readonly issues: unknown;

  constructor(message: string, issues?: unknown) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.issues = issues;
  }
}
