/**
 * Utility functions used throughout the SDK
 */

/**
 * Get current timestamp in milliseconds
 */
export function getTimeMs(): number {
  return Date.now();
}

/**
 * Type guard to check if an error is an AbortError (manual abort)
 */
export function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Type guard to check if an error is a TimeoutError (timeout abort)
 */
export function isTimeoutError(error: unknown): error is Error {
  return error instanceof Error && error.name === "TimeoutError";
}
