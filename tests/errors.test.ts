import { describe, it, expect } from "vitest";
import { ErrorCode, gatewayError } from "../src/gateway/errors.js";

describe("Gateway Errors", () => {
  it("creates a structured error object", () => {
    const err = gatewayError("Test error", ErrorCode.INVALID_REQUEST);
    expect(err.error.message).toBe("Test error");
    expect(err.error.type).toBe("invalid_request_error");
  });

  it("includes details when provided", () => {
    const err = gatewayError("Bad input", ErrorCode.INVALID_REQUEST, { field: "model" });
    expect(err.error.details).toEqual({ field: "model" });
  });

  it("omits details when not provided", () => {
    const err = gatewayError("Not found", ErrorCode.NOT_FOUND);
    expect(err.error.details).toBeUndefined();
  });

  it("has all expected error codes", () => {
    expect(ErrorCode.INVALID_REQUEST).toBe("invalid_request_error");
    expect(ErrorCode.AUTHENTICATION).toBe("authentication_error");
    expect(ErrorCode.BUDGET_EXCEEDED).toBe("budget_exceeded");
    expect(ErrorCode.RATE_LIMITED).toBe("rate_limit_error");
    expect(ErrorCode.ALL_PROVIDERS_FAILED).toBe("all_providers_failed");
    expect(ErrorCode.SERVER_ERROR).toBe("server_error");
    expect(ErrorCode.NOT_FOUND).toBe("not_found");
  });
});
