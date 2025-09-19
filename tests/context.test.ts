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

      const context = new Context(mockMetadata, mockMessages, storeValue, llm, http);

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

      const context = new Context(mockMetadata, mockMessages, storeValue, llm, http);

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
        storeValue,
        {} as LLM,
        {} as HTTPClient
      );

      expect(context.events).toEqual([]);
      expect(Array.isArray(context.events)).toBe(true);
    });
  });
});
