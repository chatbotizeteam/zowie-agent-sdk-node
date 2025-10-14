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

    it("should create Google provider with thinkingBudget config", () => {
      const config: GoogleProviderConfig = {
        provider: "google",
        apiKey: "test-key",
        model: "gemini-2.5-pro",
        thinkingBudget: 1024,
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

    it("should create OpenAI provider with reasoningEffort config", () => {
      const config: OpenAIProviderConfig = {
        provider: "openai",
        apiKey: "test-key",
        model: "o1",
        reasoningEffort: "high",
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
        // Events is now second-to-last (before parameters)
        const events = args[args.length - 2];
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
        // Events is now second-to-last (before parameters)
        const events = args[args.length - 2];
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

  describe("generateContent with parameters", () => {
    let mockLLM: LLM;
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let events: any[];
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let mockGenerateContent: any;

    beforeEach(async () => {
      const config: OpenAIProviderConfig = {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-5-mini",
      };
      mockLLM = new LLM(config, true, true);
      events = [];

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const provider = await (mockLLM as any).getProvider();

      mockGenerateContent = jest.fn();
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      mockGenerateContent.mockImplementation((...args: any[]) => {
        const events = args[args.length - 2]; // events is second to last
        const parameters = args[args.length - 1]; // parameters is last
        if (Array.isArray(events)) {
          const promptData = {
            messages: args[0],
            system_instruction: args[1],
            parameters,
          };
          events.push({
            type: "llm_call",
            payload: {
              prompt: JSON.stringify(promptData, null, 2),
              response: "Mock response with parameters",
              model: "gpt-5-mini",
              durationInMillis: 100,
            },
          });
        }
        return Promise.resolve("Mock response with parameters");
      });
      provider.generateContent = mockGenerateContent;
    });

    it("should accept and forward parameters to provider", async () => {
      const parameters = {
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
      };

      const response = await mockLLM.generateContent(
        mockMessages,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events,
        parameters
      );

      expect(response).toBe("Mock response with parameters");
      expect(mockGenerateContent).toHaveBeenCalled();

      // Verify parameters were passed
      const callArgs = mockGenerateContent.mock.calls[0];
      expect(callArgs[callArgs.length - 1]).toEqual(parameters);
    });

    it("should work without parameters (backward compatibility)", async () => {
      const response = await mockLLM.generateContent(
        mockMessages,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(response).toBe("Mock response with parameters");
      expect(mockGenerateContent).toHaveBeenCalled();
    });
  });

  describe("generateContentWithCandidates", () => {
    let mockLLM: LLM;
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let events: any[];
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let mockGenerateContentWithCandidates: any;

    beforeEach(async () => {
      const config: GoogleProviderConfig = {
        provider: "google",
        apiKey: "test-key",
        model: "gemini-2.5-flash",
      };
      mockLLM = new LLM(config, true, true);
      events = [];

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const provider = await (mockLLM as any).getProvider();

      mockGenerateContentWithCandidates = jest.fn();
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      mockGenerateContentWithCandidates.mockImplementation((...args: any[]) => {
        const candidateCount = args[1];
        const events = args[args.length - 2];
        if (Array.isArray(events)) {
          const promptData = {
            messages: args[0],
            system_instruction: args[2],
            candidateCount,
          };
          events.push({
            type: "llm_call",
            payload: {
              prompt: JSON.stringify(promptData, null, 2),
              response: JSON.stringify(["Response 1", "Response 2", "Response 3"]),
              model: "gemini-2.5-flash",
              durationInMillis: 150,
            },
          });
        }
        return Promise.resolve(["Response 1", "Response 2", "Response 3"]);
      });
      provider.generateContentWithCandidates = mockGenerateContentWithCandidates;
    });

    it("should return multiple candidates", async () => {
      const responses = await mockLLM.generateContentWithCandidates(
        mockMessages,
        3,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(Array.isArray(responses)).toBe(true);
      expect(responses).toHaveLength(3);
      expect(responses[0]).toBe("Response 1");
      expect(responses[1]).toBe("Response 2");
      expect(responses[2]).toBe("Response 3");
    });

    it("should track events for multi-candidate generation", async () => {
      await mockLLM.generateContentWithCandidates(
        mockMessages,
        3,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("llm_call");
      expect(events[0].payload.response).toContain("Response 1");
    });

    it("should accept parameters with multi-candidate generation", async () => {
      const parameters = { temperature: 0.9 };

      const responses = await mockLLM.generateContentWithCandidates(
        mockMessages,
        3,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events,
        parameters
      );

      expect(responses).toHaveLength(3);
      expect(mockGenerateContentWithCandidates).toHaveBeenCalled();

      const callArgs = mockGenerateContentWithCandidates.mock.calls[0];
      expect(callArgs[callArgs.length - 1]).toEqual(parameters);
    });
  });

  describe("generateStructuredContentWithCandidates", () => {
    const TestSchema = z.object({
      field1: z.string(),
      field2: z.number(),
    });

    let mockLLM: LLM;
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let events: any[];
    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    let mockGenerateStructuredContentWithCandidates: any;

    beforeEach(async () => {
      const config: OpenAIProviderConfig = {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-5-mini",
      };
      mockLLM = new LLM(config, true, true);
      events = [];

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const provider = await (mockLLM as any).getProvider();

      const mockResponses = [
        { field1: "value1", field2: 1 },
        { field1: "value2", field2: 2 },
        { field1: "value3", field2: 3 },
      ];

      mockGenerateStructuredContentWithCandidates = jest.fn();
      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      mockGenerateStructuredContentWithCandidates.mockImplementation((...args: any[]) => {
        const candidateCount = args[1];
        const events = args[args.length - 2];
        if (Array.isArray(events)) {
          const promptData = {
            messages: args[0],
            system_instruction: args[3],
            candidateCount,
            response_schema: args[2],
          };
          events.push({
            type: "llm_call",
            payload: {
              prompt: JSON.stringify(promptData, null, 2),
              response: JSON.stringify(mockResponses),
              model: "gpt-5-mini",
              durationInMillis: 200,
            },
          });
        }
        return Promise.resolve(mockResponses);
      });
      provider.generateStructuredContentWithCandidates =
        mockGenerateStructuredContentWithCandidates;
    });

    it("should return multiple structured candidates", async () => {
      const responses = await mockLLM.generateStructuredContentWithCandidates(
        mockMessages,
        3,
        TestSchema,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(Array.isArray(responses)).toBe(true);
      expect(responses).toHaveLength(3);
      expect(responses[0]).toEqual({ field1: "value1", field2: 1 });
      expect(responses[1]).toEqual({ field1: "value2", field2: 2 });
      expect(responses[2]).toEqual({ field1: "value3", field2: 3 });
    });

    it("should validate all structured candidates against schema", async () => {
      const responses = await mockLLM.generateStructuredContentWithCandidates(
        mockMessages,
        3,
        TestSchema,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      for (const response of responses) {
        expect(typeof response.field1).toBe("string");
        expect(typeof response.field2).toBe("number");
      }
    });

    it("should track events for structured multi-candidate generation", async () => {
      await mockLLM.generateStructuredContentWithCandidates(
        mockMessages,
        3,
        TestSchema,
        "Test instruction",
        false,
        false,
        undefined,
        undefined,
        events
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("llm_call");
      expect(events[0].payload.response).toContain("value1");
    });
  });
});
