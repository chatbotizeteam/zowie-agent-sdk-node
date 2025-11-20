import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GoogleProvider } from "../src/llm/google";

describe("GoogleProvider Retry Logic", () => {
  let provider: GoogleProvider;
  // biome-ignore lint/suspicious/noExplicitAny: Mocking
  let mockGenAIGenerateContent: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    provider = new GoogleProvider({
      provider: "google",
      apiKey: "test-key",
      model: "gemini-2.5-flash",
    });

    // Get the internal genAI instance and mock its generateContent method
    // biome-ignore lint/suspicious/noExplicitAny: Mocking
    const genAI = (provider as any).getGenAI();
    mockGenAIGenerateContent = jest.fn();
    genAI.models.generateContent = mockGenAIGenerateContent;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should succeed on first attempt", async () => {
    mockGenAIGenerateContent.mockResolvedValue({
      text: "Success",
    });

    const result = await provider.generateContent([], "instruction");

    expect(result).toBe("Success");
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("should retry on 429 rate limit error and succeed", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private logger for testing
    const warnSpy = jest.spyOn((provider as any).logger, "warn");
    const error429 = new ApiError({
      status: 429,
      message:
        '{"error":{"code":429,"message":"Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED"}}',
    });
    mockGenAIGenerateContent
      .mockRejectedValueOnce(error429)
      .mockResolvedValue({ text: "Success after retry" });

    const promise = provider.generateContent([], "instruction");

    // Fast-forward time for the backoff
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe("Success after retry");
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(2);

    // Verify backoff delay (1000ms base * 2^0 + jitter)
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logMessage = warnSpy.mock.calls[0]?.[0] as string;
    const delayMatch = logMessage.match(/Retrying in (\d+)ms/);
    expect(delayMatch).toBeTruthy();
    if (!delayMatch) throw new Error("Log message format incorrect");
    const delay = parseInt(delayMatch[1]!, 10);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThan(1500);
  });

  it("should retry on 500 server error and succeed", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private logger for testing
    const warnSpy = jest.spyOn((provider as any).logger, "warn");
    const error500 = new ApiError({
      status: 500,
      message: '{"error":{"code":500,"message":"Internal error encountered.","status":"INTERNAL"}}',
    });
    mockGenAIGenerateContent
      .mockRejectedValueOnce(error500)
      .mockResolvedValue({ text: "Success after retry" });

    const promise = provider.generateContent([], "instruction");

    // Fast-forward time for the backoff
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe("Success after retry");
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(2);

    // Verify backoff delay
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logMessage = warnSpy.mock.calls[0]?.[0] as string;
    const delayMatch = logMessage.match(/Retrying in (\d+)ms/);
    expect(delayMatch).toBeTruthy();
    if (!delayMatch) throw new Error("Log message format incorrect");
    const delay = parseInt(delayMatch[1]!, 10);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThan(1500);
  });

  it("should retry on 503 service unavailable and succeed", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private logger for testing
    const warnSpy = jest.spyOn((provider as any).logger, "warn");
    const error503 = new ApiError({
      status: 503,
      message: '{"error":{"code":503,"message":"The model is overloaded.","status":"UNAVAILABLE"}}',
    });
    mockGenAIGenerateContent
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockResolvedValue({ text: "Success after 2 retries" });

    const promise = provider.generateContent([], "instruction");

    // Fast-forward time for the backoff
    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe("Success after 2 retries");
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(3);

    // Verify backoff delays
    expect(warnSpy).toHaveBeenCalledTimes(2);

    // First retry: 1000-1500ms
    const log1 = warnSpy.mock.calls[0]?.[0] as string;
    const match1 = log1.match(/Retrying in (\d+)ms/);
    if (!match1) throw new Error("Log message format incorrect");
    const delay1 = parseInt(match1[1]!, 10);
    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThan(1500);

    // Second retry: 2000-2500ms (base * 2^1 + jitter)
    const log2 = warnSpy.mock.calls[1]?.[0] as string;
    const match2 = log2.match(/Retrying in (\d+)ms/);
    if (!match2) throw new Error("Log message format incorrect");
    const delay2 = parseInt(match2[1]!, 10);
    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThan(2500);
  });

  it("should fail after max retries", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private logger for testing
    const warnSpy = jest.spyOn((provider as any).logger, "warn");
    const error500 = new ApiError({
      status: 500,
      message: '{"error":{"code":500,"message":"Internal error encountered.","status":"INTERNAL"}}',
    });
    mockGenAIGenerateContent.mockRejectedValue(error500);

    const promise = provider.generateContent([], "instruction");

    // Attach expectation before running timers to catch rejection
    const assertion = expect(promise).rejects.toMatchObject({ status: 500 });

    // Fast-forward time for all retries
    await jest.runAllTimersAsync();

    await assertion;
    // Initial + 3 retries = 4 calls
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(4);

    // Verify all 3 retries logged with increasing delays
    expect(warnSpy).toHaveBeenCalledTimes(3);

    const log1 = warnSpy.mock.calls[0]?.[0] as string;
    const match1 = log1.match(/Retrying in (\d+)ms/);
    if (!match1) throw new Error("Log message format incorrect");
    const delay1 = parseInt(match1[1]!, 10);
    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThan(1500);

    const log2 = warnSpy.mock.calls[1]?.[0] as string;
    const match2 = log2.match(/Retrying in (\d+)ms/);
    if (!match2) throw new Error("Log message format incorrect");
    const delay2 = parseInt(match2[1]!, 10);
    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThan(2500);

    const log3 = warnSpy.mock.calls[2]?.[0] as string;
    const match3 = log3.match(/Retrying in (\d+)ms/);
    if (!match3) throw new Error("Log message format incorrect");
    const delay3 = parseInt(match3[1]!, 10);
    expect(delay3).toBeGreaterThanOrEqual(4000);
    expect(delay3).toBeLessThan(4500);
  });

  it("should NOT retry on 400 bad request error", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private logger for testing
    const warnSpy = jest.spyOn((provider as any).logger, "warn");
    const error400 = new ApiError({
      status: 400,
      message: '{"error":{"code":400,"message":"Invalid argument.","status":"INVALID_ARGUMENT"}}',
    });

    mockGenAIGenerateContent.mockRejectedValue(error400);

    const promise = provider.generateContent([], "instruction");
    const assertion = expect(promise).rejects.toMatchObject({ status: 400 });

    await jest.runAllTimersAsync();

    await assertion;
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should NOT retry on 403 permission denied error", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private logger for testing
    const warnSpy = jest.spyOn((provider as any).logger, "warn");
    const error403 = new ApiError({
      status: 403,
      message:
        '{"error":{"code":403,"message":"Method doesn\'t allow unregistered callers...","status":"PERMISSION_DENIED"}}',
    });

    mockGenAIGenerateContent.mockRejectedValue(error403);

    const promise = provider.generateContent([], "instruction");
    const assertion = expect(promise).rejects.toMatchObject({ status: 403 });

    await jest.runAllTimersAsync();

    await assertion;
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should NOT retry on 404 not found error", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private logger for testing
    const warnSpy = jest.spyOn((provider as any).logger, "warn");
    const error404 = new ApiError({
      status: 404,
      message: '{"error":{"code":404,"message":"Resource not found.","status":"NOT_FOUND"}}',
    });

    mockGenAIGenerateContent.mockRejectedValue(error404);

    const promise = provider.generateContent([], "instruction");
    const assertion = expect(promise).rejects.toMatchObject({ status: 404 });

    await jest.runAllTimersAsync();

    await assertion;
    expect(mockGenAIGenerateContent).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
