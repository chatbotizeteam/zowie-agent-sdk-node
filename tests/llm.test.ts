import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { z } from "zod";
import type { GoogleProviderConfig, OpenAIProviderConfig } from "../src/domain";
import { LLM } from "../src/llm/index";
import type { Message, Persona } from "../src/protocol";

describe("LLM Integration", () => {
  const mockMessages: Message[] = [
    {
      author: "User",
      content: "Hello",
      timestamp: new Date().toISOString(),
    },
  ];

  const mockPersona: Persona = {
    name: "Test Assistant",
    businessContext: "Customer support",
    toneOfVoice: "Friendly",
  };

  describe("LLM Provider Factory", () => {
    it("should create Google provider with correct config", () => {
      const config: GoogleProviderConfig = {
        provider: "google",
        apiKey: "test-key",
        model: "gemini-2.5-flash",
      };
      const llm = new LLM(config, true, true);
      expect(llm).toBeDefined();
    });

    it("should create OpenAI provider with correct config", () => {
      const config: OpenAIProviderConfig = {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-5-mini",
      };
      const llm = new LLM(config, true, true);
      expect(llm).toBeDefined();
    });
  });

  describe("generateContent", () => {
    let mockLLM: LLM;
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let events: any[];
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let mockGenerateContent: any;

    beforeEach(async () => {
      const config: GoogleProviderConfig = {
        provider: "google",
        apiKey: "test-key",
        model: "gemini-2.5-flash",
      };
      mockLLM = new LLM(config, true, true);
      events = [];

      // Wait for provider to initialize and then mock it
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const provider = await (mockLLM as any).getProvider();

      // Mock the provider's generateContent method
      mockGenerateContent = jest.fn();
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      mockGenerateContent.mockImplementation((...args: any[]) => {
        // The last argument is the events array
        const events = args[args.length - 1];
        if (Array.isArray(events)) {
          const promptData = {
            messages: args[0],
            system_instruction: args[1],
          };
          events.push({
            type: "llm_call",
            payload: {
              prompt: JSON.stringify(promptData, null, 2),
              response: "Mock response",
              model: "gemini-2.5-flash",
              durationInMillis: 100,
            },
          });
        }
        return Promise.resolve("Mock response");
      });
      provider.generateContent = mockGenerateContent;
    });

    it("should include persona when includePersona is true", async () => {
      const response = await mockLLM.generateContent(
        mockMessages,
        "Test instruction",
        true, // includePersona
        false, // includeContext
        mockPersona,
        undefined,
        events
      );

      expect(response).toBe("Mock response");
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("should include context when includeContext is true", async () => {
      const contextString = "User is a premium customer";

      const response = await mockLLM.generateContent(
        mockMessages,
        "Test instruction",
        false, // includePersona
        true, // includeContext
        undefined,
        contextString,
        events
      );

      expect(response).toBe("Mock response");
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("should track events properly", async () => {
      await mockLLM.generateContent(
        mockMessages,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "llm_call",
        payload: expect.objectContaining({
          prompt: expect.any(String),
          response: "Mock response",
          model: "gemini-2.5-flash",
          durationInMillis: expect.any(Number),
        }),
      });
    });
  });

  describe("generateStructuredContent", () => {
    const TestSchema = z.object({
      field1: z.string(),
      field2: z.number(),
      field3: z.boolean(),
    });

    let mockLLM: LLM;
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let events: any[];

    beforeEach(async () => {
      const config: OpenAIProviderConfig = {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-5-mini",
      };
      mockLLM = new LLM(config, true, true);
      events = [];

      // Wait for provider to initialize and then mock it
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const provider = await (mockLLM as any).getProvider();

      // Mock the internal provider's generateStructuredContent method
      const mockStructuredResponse = {
        field1: "test value",
        field2: 42,
        field3: true,
      };
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const mockGenerateStructuredContent: jest.MockedFunction<any> = jest.fn();
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      mockGenerateStructuredContent.mockImplementation((...args: any[]) => {
        // The last argument is the events array
        const events = args[args.length - 1];
        if (Array.isArray(events)) {
          const promptData = {
            messages: args[0],
            system_instruction: args[2],
            response_schema: args[1],
          };
          events.push({
            type: "llm_call",
            payload: {
              prompt: JSON.stringify(promptData, null, 2),
              response: JSON.stringify(mockStructuredResponse),
              model: "gpt-5-mini",
              durationInMillis: 150,
            },
          });
        }
        return Promise.resolve(mockStructuredResponse);
      });
      provider.generateStructuredContent = mockGenerateStructuredContent;
    });

    it("should return typed structured content", async () => {
      const result = await mockLLM.generateStructuredContent(
        mockMessages,
        TestSchema,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(result).toEqual({
        field1: "test value",
        field2: 42,
        field3: true,
      });
      expect(typeof result.field1).toBe("string");
      expect(typeof result.field2).toBe("number");
      expect(typeof result.field3).toBe("boolean");
    });

    it("should validate response against schema", async () => {
      // Mock an invalid response that doesn't match the schema
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const provider = await (mockLLM as any).getProvider();
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const mockInvalidStructuredContent: jest.MockedFunction<any> = jest.fn();
      // Simulate what would happen if the provider's validation fails
      mockInvalidStructuredContent.mockRejectedValue(
        new Error("Schema validation failed: field2 must be a number")
      );
      provider.generateStructuredContent = mockInvalidStructuredContent;

      await expect(
        mockLLM.generateStructuredContent(
          mockMessages,
          TestSchema,
          "Test instruction",
          false,
          false,
          undefined,
          undefined,
          events
        )
      ).rejects.toThrow();
    });

    it("should track structured events properly", async () => {
      await mockLLM.generateStructuredContent(
        mockMessages,
        TestSchema,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "llm_call",
        payload: expect.objectContaining({
          prompt: expect.any(String),
          response: expect.stringContaining("field1"),
          model: "gpt-5-mini",
          durationInMillis: expect.any(Number),
        }),
      });
    });
  });
});
