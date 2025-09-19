/**
 * HTTP client with automatic request/response event tracking.
 *
 * All HTTP requests are automatically logged as APICallEvent objects for
 * observability and debugging. Supports configurable timeouts and header
 * inclusion controls.
 *
 * Thread-safe: Events are passed per-request, not stored in the instance.
 */

import type winston from "winston";
import { getLogger } from "./logger.js";
import type { APICallEvent, Event } from "./protocol.js";
import { getTimeMs, isAbortError, isTimeoutError } from "./utils.js";

export interface HTTPRequestOptions {
  timeout?: number;
  includeHeaders?: boolean;
  includeRequestBody?: boolean;
}

export class HTTPClient {
  private readonly defaultTimeoutMs: number;
  private readonly includeHeadersByDefault: boolean;
  private readonly includeRequestBodiesByDefault: boolean;
  private readonly logger: winston.Logger;

  constructor(
    defaultTimeoutMs = 10000,
    includeHeadersByDefault = true,
    includeRequestBodiesByDefault = true
  ) {
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.includeHeadersByDefault = includeHeadersByDefault;
    this.includeRequestBodiesByDefault = includeRequestBodiesByDefault;
    this.logger = getLogger("zowie_agent.HTTPClient");
  }

  /**
   * Execute an operation with timing tracking
   */
  protected async withTiming<T>(
    operation: () => Promise<T>
  ): Promise<{ result?: T; durationMs: number; error?: Error }> {
    const startTime = getTimeMs();
    try {
      const result = await operation();
      const endTime = getTimeMs();
      return { result, durationMs: endTime - startTime };
    } catch (err) {
      const endTime = getTimeMs();
      const error = err instanceof Error ? err : new Error(String(err));
      return { durationMs: endTime - startTime, error };
    }
  }

  private async request(
    method: string,
    url: string,
    headers: Record<string, string>,
    events: Event[],
    body?: unknown,
    options?: HTTPRequestOptions
  ): Promise<Response> {
    const timeoutMs = options?.timeout ?? this.defaultTimeoutMs;
    const includeHeaders = options?.includeHeaders ?? this.includeHeadersByDefault;
    const includeRequestBody = options?.includeRequestBody ?? this.includeRequestBodiesByDefault;

    this.logger.debug("Making HTTP request", { method, url, timeout: timeoutMs });

    const { result, durationMs, error } = await this.withTiming(async () => {
      const abortSignal = AbortSignal.timeout(timeoutMs);

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: abortSignal,
      };

      if (body !== undefined && method !== "GET" && method !== "DELETE") {
        fetchOptions.body = JSON.stringify(body);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }

      return await fetch(url, fetchOptions);
    });

    if (error) {
      // Handle error case
      let statusCode = 0;
      let errorResponseBody = error.message;

      if (isTimeoutError(error)) {
        statusCode = 504;
        errorResponseBody = "Request timeout";
      } else if (isAbortError(error)) {
        statusCode = 499; // Client Closed Request
        errorResponseBody = "Request aborted";
      } else {
        // Handle other fetch errors
        const errorMessage = (error as Error).message;
        if (errorMessage?.includes("fetch")) {
          statusCode = 0;
        }
      }

      this.logger.error("HTTP request failed", {
        method,
        url,
        statusCode,
        duration: durationMs,
        error: error.message,
      });

      // Log failed API call event
      const apiCallEvent: APICallEvent = {
        type: "api_call",
        payload: {
          url,
          requestMethod: method,
          requestHeaders: includeHeaders ? headers : {},
          requestBody: includeRequestBody && body ? JSON.stringify(body) : undefined,
          responseHeaders: {},
          responseStatusCode: statusCode,
          responseBody: errorResponseBody,
          durationInMillis: durationMs,
        },
      };

      events.push(apiCallEvent);
      throw error;
    }

    // Handle success case
    if (!result) {
      throw new Error("Unexpected: no result and no error from withTiming");
    }

    // Read response body for logging - try JSON first, fall back to text
    let responseBody: string;
    try {
      const contentType = result.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const jsonData = await result.clone().json();
        responseBody = JSON.stringify(jsonData);
      } else {
        responseBody = await result.clone().text();
      }
    } catch {
      responseBody = "[Failed to parse response body]";
    }

    this.logger.debug("HTTP request completed", {
      method,
      url,
      statusCode: result.status,
      duration: durationMs,
    });

    // Log successful API call event
    const apiCallEvent: APICallEvent = {
      type: "api_call",
      payload: {
        url,
        requestMethod: method,
        requestHeaders: includeHeaders ? headers : {},
        requestBody: includeRequestBody && body ? JSON.stringify(body) : undefined,
        responseHeaders: includeHeaders ? Object.fromEntries(result.headers.entries()) : {},
        responseStatusCode: result.status,
        responseBody,
        durationInMillis: durationMs,
      },
    };

    events.push(apiCallEvent);
    return result;
  }

  async get(
    url: string,
    headers: Record<string, string> = {},
    events: Event[] = [],
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.request("GET", url, headers, events, undefined, options);
  }

  async post(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    events: Event[] = [],
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.request("POST", url, headers, events, body, options);
  }

  async put(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    events: Event[] = [],
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.request("PUT", url, headers, events, body, options);
  }

  async patch(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    events: Event[] = [],
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.request("PATCH", url, headers, events, body, options);
  }

  async delete(
    url: string,
    headers: Record<string, string> = {},
    events: Event[] = [],
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.request("DELETE", url, headers, events, undefined, options);
  }
}
