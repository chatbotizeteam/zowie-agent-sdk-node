import { describe, expect, it, jest } from "@jest/globals";
import { Context } from "../src/context";
import type { HTTPClient } from "../src/http";
import type { LLM } from "../src/llm/index";
import type { Event, Message, Metadata, Persona } from "../src/protocol";

describe("Context", () => {
  const mockMetadata: Metadata = {
    requestId: "test-123",
    chatbotId: "bot-456",
    conversationId: "conv-789",
    interactionId: "int-012",
  };

  const mockMessages: Message[] = [
    {
      author: "User",
      content: "Hello",
      timestamp: new Date().toISOString(),
    },
    {
      author: "Chatbot",
      content: "Hi there!",
      timestamp: new Date().toISOString(),
    },
  ];

  const mockPersona: Persona = {
    name: "Support Agent",
    businessContext: "Customer support for tech company",
    toneOfVoice: "Professional and helpful",
  };

  describe("Context initialization", () => {
    it("should initialize with required properties", () => {
      const storeValue = jest.fn();
      const llm = {} as LLM;
      const http = {} as HTTPClient;

      const context = new Context(mockMetadata, mockMessages, "/", {}, {}, storeValue, llm, http);

      expect(context.metadata).toEqual(mockMetadata);
      expect(context.messages).toEqual(mockMessages);
      expect(context.storeValue).toBe(storeValue);
      expect(context.persona).toBeUndefined();
      expect(context.context).toBeUndefined();
      expect(context.events).toEqual([]);
    });

    it("should initialize with optional properties", () => {
      const storeValue = jest.fn();
      const llm = {} as LLM;
      const http = {} as HTTPClient;
      const events: Event[] = [];
      const contextString = "User is a premium customer";

      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        storeValue,
        llm,
        http,
        mockPersona,
        contextString,
        events
      );

      expect(context.persona).toEqual(mockPersona);
      expect(context.context).toBe(contextString);
      expect(context.events).toBe(events);
    });

    it("should create contextual clients", () => {
      const storeValue = jest.fn();
      const llm = {} as LLM;
      const http = {} as HTTPClient;

      const context = new Context(mockMetadata, mockMessages, "/", {}, {}, storeValue, llm, http);

      expect(context.llm).toBeDefined();
      expect(context.http).toBeDefined();
      expect(context.llm.constructor.name).toBe("ContextualLLM");
      expect(context.http.constructor.name).toBe("ContextualHTTPClient");
    });
  });

  describe("Value storage", () => {
    it("should store values through storeValue function", () => {
      const storeValue = jest.fn();
      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        storeValue,
        {} as LLM,
        {} as HTTPClient
      );

      context.storeValue("testKey", "testValue");
      expect(storeValue).toHaveBeenCalledWith("testKey", "testValue");
    });

    it("should store different types of values", () => {
      const storeValue = jest.fn();
      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        storeValue,
        {} as LLM,
        {} as HTTPClient
      );

      // Test different value types
      context.storeValue("string", "hello");
      context.storeValue("number", 42);
      context.storeValue("boolean", true);
      context.storeValue("object", { key: "value" });
      context.storeValue("array", [1, 2, 3]);

      expect(storeValue).toHaveBeenCalledTimes(5);
      expect(storeValue).toHaveBeenCalledWith("string", "hello");
      expect(storeValue).toHaveBeenCalledWith("number", 42);
      expect(storeValue).toHaveBeenCalledWith("boolean", true);
      expect(storeValue).toHaveBeenCalledWith("object", { key: "value" });
      expect(storeValue).toHaveBeenCalledWith("array", [1, 2, 3]);
    });
  });

  describe("Event management", () => {
    it("should share events array between context and clients", () => {
      const storeValue = jest.fn();
      const llm = {} as LLM;
      const http = {} as HTTPClient;
      const events: Event[] = [];

      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        storeValue,
        llm,
        http,
        undefined,
        undefined,
        events
      );

      // Events array should be shared
      expect(context.events).toBe(events);

      // Add an event to verify it's the same reference
      const testEvent: Event = {
        type: "llm_call",
        payload: {
          prompt: "test",
          response: "test response",
          model: "test-model",
          durationInMillis: 100,
        },
      };

      context.events.push(testEvent);
      expect(events).toContain(testEvent);
      expect(events).toHaveLength(1);
    });

    it("should initialize empty events array when none provided", () => {
      const storeValue = jest.fn();
      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        storeValue,
        {} as LLM,
        {} as HTTPClient
      );

      expect(context.events).toEqual([]);
      expect(Array.isArray(context.events)).toBe(true);
    });
  });

  describe("Manual event logging", () => {
    it("should log LLM call event with logLLMCall", () => {
      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        jest.fn(),
        {} as LLM,
        {} as HTTPClient
      );

      context.logLLMCall({
        prompt: "What is 2+2?",
        response: "4",
        model: "gpt-4",
        durationInMillis: 150,
      });

      expect(context.events).toHaveLength(1);
      expect(context.events[0]).toEqual({
        type: "llm_call",
        payload: {
          prompt: "What is 2+2?",
          response: "4",
          model: "gpt-4",
          durationInMillis: 150,
        },
      });
    });

    it("should log API call event with logAPICall", () => {
      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        jest.fn(),
        {} as LLM,
        {} as HTTPClient
      );

      context.logAPICall({
        url: "https://api.example.com/data",
        requestMethod: "GET",
        responseStatusCode: 200,
        durationInMillis: 50,
      });

      expect(context.events).toHaveLength(1);
      expect(context.events[0]).toEqual({
        type: "api_call",
        payload: {
          url: "https://api.example.com/data",
          requestMethod: "GET",
          requestHeaders: {},
          requestBody: undefined,
          responseHeaders: {},
          responseStatusCode: 200,
          responseBody: undefined,
          durationInMillis: 50,
        },
      });
    });

    it("should log API call event with all optional fields", () => {
      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        jest.fn(),
        {} as LLM,
        {} as HTTPClient
      );

      context.logAPICall({
        url: "https://api.example.com/users",
        requestMethod: "POST",
        requestHeaders: { "Content-Type": "application/json" },
        requestBody: '{"name":"John"}',
        responseHeaders: { "X-Request-Id": "abc123" },
        responseStatusCode: 201,
        responseBody: '{"id":1,"name":"John"}',
        durationInMillis: 120,
      });

      expect(context.events).toHaveLength(1);
      expect(context.events[0]).toEqual({
        type: "api_call",
        payload: {
          url: "https://api.example.com/users",
          requestMethod: "POST",
          requestHeaders: { "Content-Type": "application/json" },
          requestBody: '{"name":"John"}',
          responseHeaders: { "X-Request-Id": "abc123" },
          responseStatusCode: 201,
          responseBody: '{"id":1,"name":"John"}',
          durationInMillis: 120,
        },
      });
    });

    it("should accumulate multiple events", () => {
      const context = new Context(
        mockMetadata,
        mockMessages,
        "/",
        {},
        {},
        jest.fn(),
        {} as LLM,
        {} as HTTPClient
      );

      context.logLLMCall({
        prompt: "Hello",
        response: "Hi",
        model: "gpt-4",
        durationInMillis: 100,
      });

      context.logAPICall({
        url: "https://api.example.com",
        requestMethod: "GET",
        responseStatusCode: 200,
        durationInMillis: 50,
      });

      context.logLLMCall({
        prompt: "Goodbye",
        response: "Bye",
        model: "claude-3",
        durationInMillis: 80,
      });

      expect(context.events).toHaveLength(3);
      expect(context.events[0]?.type).toBe("llm_call");
      expect(context.events[1]?.type).toBe("api_call");
      expect(context.events[2]?.type).toBe("llm_call");
    });
  });
});
