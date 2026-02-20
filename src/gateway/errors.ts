export const ErrorCode = {
  INVALID_REQUEST: "invalid_request_error",
  AUTHENTICATION: "authentication_error",
  BUDGET_EXCEEDED: "budget_exceeded",
  RATE_LIMITED: "rate_limit_error",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  ALL_PROVIDERS_FAILED: "all_providers_failed",
  MODEL_NOT_FOUND: "model_not_found",
  STREAM_ERROR: "stream_error",
  SERVER_ERROR: "server_error",
  NOT_FOUND: "not_found",
  SERVICE_UNAVAILABLE: "service_unavailable",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface GatewayError {
  error: {
    message: string;
    type: ErrorCodeType;
    code?: string;
    details?: unknown;
  };
}

export function gatewayError(
  message: string,
  type: ErrorCodeType,
  details?: unknown
): GatewayError {
  return {
    error: {
      message,
      type,
      ...(details ? { details } : {}),
    },
  };
}
