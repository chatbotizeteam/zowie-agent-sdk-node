import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { z } from "zod";
import type { GoogleProviderConfig, OpenAIProviderConfig } from "../src/domain";
import { formatMessageContent, prepareMessagesForLLM } from "../src/llm/base";
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

    it("should create Google provider with vertexai config and httpOptions", () => {
      const config: GoogleProviderConfig = {
        provider: "google",
        model: "gemini-2.5-flash",
        vertexai: {
          project: "test-project",
          location: "us-central1",
          httpOptions: {
            apiVersion: "v1",
            headers: {
              "X-Vertex-AI-LLM-Request-Type": "shared",
              "X-Vertex-AI-LLM-Shared-Request-Type": "priority",
            },
          },
        },
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

describe("formatMessageContent", () => {
  const ts = "2024-01-01T12:00:00Z";
  const base = (overrides: Partial<Message>): Message => ({
    author: "Chatbot",
    content: "Hello",
    timestamp: ts,
    ...overrides,
  });

  it("returns plain user content unchanged", () => {
    expect(formatMessageContent(base({ author: "User" }))).toBe("Hello");
  });

  it("returns plain chatbot content unchanged", () => {
    expect(formatMessageContent(base({}))).toBe("Hello");
  });

  it("prefixes SKIPPED when skipped is true", () => {
    expect(formatMessageContent(base({ skipped: true }))).toBe("SKIPPED: Hello");
  });

  it("prefixes INTERRUPTED when interrupted is true", () => {
    expect(formatMessageContent(base({ interrupted: true }))).toBe("INTERRUPTED: Hello");
  });

  it("prefixes CANCELLED when cancelled is true", () => {
    expect(formatMessageContent(base({ cancelled: true }))).toBe("CANCELLED: Hello");
  });

  it("prefixes SKIPPED/INTERRUPTED when both flags are true", () => {
    expect(formatMessageContent(base({ skipped: true, interrupted: true }))).toBe(
      "SKIPPED/INTERRUPTED: Hello"
    );
  });

  it("joins multiple flags with / in declaration order", () => {
    expect(formatMessageContent(base({ skipped: true, cancelled: true }))).toBe(
      "SKIPPED/CANCELLED: Hello"
    );
    expect(formatMessageContent(base({ skipped: true, interrupted: true, cancelled: true }))).toBe(
      "SKIPPED/INTERRUPTED/CANCELLED: Hello"
    );
  });

  it("leaves content unchanged when flags are explicitly false", () => {
    expect(
      formatMessageContent(base({ skipped: false, interrupted: false, cancelled: false }))
    ).toBe("Hello");
  });
});

// Mixed conversation reused across conversion tests:
// plain user, plain chatbot, skipped, interrupted, cancelled, both.
const conversionTs = "2024-01-01T12:00:00Z";
const mixedMessages: Message[] = [
  { author: "User", content: "hi", timestamp: conversionTs },
  { author: "Chatbot", content: "reply", timestamp: conversionTs },
  { author: "Chatbot", content: "s", timestamp: conversionTs, skipped: true },
  { author: "Chatbot", content: "i", timestamp: conversionTs, interrupted: true },
  { author: "Chatbot", content: "x", timestamp: conversionTs, cancelled: true },
  { author: "Chatbot", content: "b", timestamp: conversionTs, skipped: true, interrupted: true },
];

// What the LLM-facing messages look like: content prefixed, flags dropped.
const expectedLLMMessages = [
  { author: "User", content: "hi", timestamp: conversionTs },
  { author: "Chatbot", content: "reply", timestamp: conversionTs },
  { author: "Chatbot", content: "SKIPPED: s", timestamp: conversionTs },
  { author: "Chatbot", content: "INTERRUPTED: i", timestamp: conversionTs },
  { author: "Chatbot", content: "CANCELLED: x", timestamp: conversionTs },
  { author: "Chatbot", content: "SKIPPED/INTERRUPTED: b", timestamp: conversionTs },
];

describe("prepareMessagesForLLM", () => {
  it("prefixes content with the delivery state and drops the flags", () => {
    const result = prepareMessagesForLLM(mixedMessages);
    expect(result).toEqual(expectedLLMMessages);
  });

  it("does not carry skipped/interrupted/cancelled keys on any message", () => {
    for (const message of prepareMessagesForLLM(mixedMessages)) {
      expect("skipped" in message).toBe(false);
      expect("interrupted" in message).toBe(false);
      expect("cancelled" in message).toBe(false);
    }
  });

  it("does not mutate the input messages", () => {
    const input = [
      { author: "Chatbot" as const, content: "x", timestamp: conversionTs, skipped: true },
    ];
    prepareMessagesForLLM(input);
    expect(input[0]).toEqual({
      author: "Chatbot",
      content: "x",
      timestamp: conversionTs,
      skipped: true,
    });
  });
});

describe("OpenAI provider sends & logs prefixed content", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test mock holders
  let provider: any;
  // biome-ignore lint/suspicious/noExplicitAny: test mock holders
  let create: any;
  // biome-ignore lint/suspicious/noExplicitAny: test mock holders
  let events: any[];

  beforeEach(async () => {
    const config: OpenAIProviderConfig = {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-5-mini",
    };
    const llm = new LLM(config, true, true);
    // biome-ignore lint/suspicious/noExplicitAny: accessing internals for testing
    provider = await (llm as any).getProvider();
    create = jest.fn();
    create.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    provider.openai = { chat: { completions: { create } } };
    events = [];
  });

  it("sends prefixed content (role + content only) to OpenAI", async () => {
    await provider.generateContent(
      mixedMessages,
      undefined,
      false,
      false,
      undefined,
      undefined,
      events
    );

    const sent = create.mock.calls[0][0].messages;
    expect(sent).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "reply" },
      { role: "assistant", content: "SKIPPED: s" },
      { role: "assistant", content: "INTERRUPTED: i" },
      { role: "assistant", content: "CANCELLED: x" },
      { role: "assistant", content: "SKIPPED/INTERRUPTED: b" },
    ]);
  });

  it("logs exactly what was sent: prefixed content and no skipped/interrupted keys", async () => {
    await provider.generateContent(
      mixedMessages,
      undefined,
      false,
      false,
      undefined,
      undefined,
      events
    );

    const promptData = JSON.parse(events[0].payload.prompt);
    expect(promptData.messages).toEqual(expectedLLMMessages);
    expect(events[0].payload.prompt).not.toContain('"skipped"');
    expect(events[0].payload.prompt).not.toContain('"interrupted"');
    expect(events[0].payload.prompt).not.toContain('"cancelled"');
  });
});

describe("Google provider sends & logs prefixed content", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test mock holders
  let provider: any;
  // biome-ignore lint/suspicious/noExplicitAny: test mock holders
  let generateContent: any;
  // biome-ignore lint/suspicious/noExplicitAny: test mock holders
  let events: any[];

  beforeEach(async () => {
    const config: GoogleProviderConfig = {
      provider: "google",
      apiKey: "test-key",
      model: "gemini-2.5-flash",
    };
    const llm = new LLM(config, true, true);
    // biome-ignore lint/suspicious/noExplicitAny: accessing internals for testing
    provider = await (llm as any).getProvider();
    generateContent = jest.fn();
    generateContent.mockResolvedValue({ text: "ok" });
    provider.genAI = { models: { generateContent } };
    events = [];
  });

  it("sends prefixed content (role + parts only) to Gemini", async () => {
    await provider.generateContent(
      mixedMessages,
      undefined,
      false,
      false,
      undefined,
      undefined,
      events
    );

    const sent = generateContent.mock.calls[0][0].contents;
    expect(sent).toEqual([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "reply" }] },
      { role: "model", parts: [{ text: "SKIPPED: s" }] },
      { role: "model", parts: [{ text: "INTERRUPTED: i" }] },
      { role: "model", parts: [{ text: "CANCELLED: x" }] },
      { role: "model", parts: [{ text: "SKIPPED/INTERRUPTED: b" }] },
    ]);
  });

  it("logs exactly what was sent: prefixed content and no skipped/interrupted keys", async () => {
    await provider.generateContent(
      mixedMessages,
      undefined,
      false,
      false,
      undefined,
      undefined,
      events
    );

    const promptData = JSON.parse(events[0].payload.prompt);
    expect(promptData.messages).toEqual(expectedLLMMessages);
    expect(events[0].payload.prompt).not.toContain('"skipped"');
    expect(events[0].payload.prompt).not.toContain('"interrupted"');
    expect(events[0].payload.prompt).not.toContain('"cancelled"');
  });
});

describe("includeRandomNonceToPreventCaching", () => {
  const config: OpenAIProviderConfig = {
    provider: "openai",
    apiKey: "test-key",
    model: "gpt-5-mini",
  };

  // biome-ignore lint/suspicious/noExplicitAny: reaching into the protected builder for testing
  const getProvider = async (llm: LLM): Promise<any> => (llm as any).getProvider();

  it("prepends a nonce at the very beginning when enabled", async () => {
    const llm = new LLM(config, false, false, true);
    const provider = await getProvider(llm);

    const systemInstruction = provider.buildSystemInstruction("Test instruction");

    expect(systemInstruction.startsWith("[Nonce: ")).toBe(true);
    expect(systemInstruction).toContain("<instructions>");
  });

  it("does not add a nonce when disabled (default)", async () => {
    const llm = new LLM(config, false, false);
    const provider = await getProvider(llm);

    const systemInstruction = provider.buildSystemInstruction("Test instruction");

    expect(systemInstruction).not.toContain("[Nonce: ");
  });

  it("generates a different nonce on each call", async () => {
    const llm = new LLM(config, false, false, true);
    const provider = await getProvider(llm);

    const first = provider.buildSystemInstruction("Test instruction");
    const second = provider.buildSystemInstruction("Test instruction");

    expect(first).not.toEqual(second);
  });
});

describe("llmTimeoutMs / llmTimeoutRetries", () => {
  const config: OpenAIProviderConfig = {
    provider: "openai",
    apiKey: "test-key",
    model: "gpt-5-mini",
  };

  // biome-ignore lint/suspicious/noExplicitAny: reaching into the protected helper for testing
  const getProvider = async (llm: LLM): Promise<any> => (llm as any).getProvider();

  // Rejects only once the per-attempt timeout aborts the signal (simulates a hung request).
  const hangUntilAbort = (signal: AbortSignal | undefined): Promise<never> =>
    new Promise((_, reject) => {
      if (!signal) {
        return; // never settles; only used in configured-timeout tests where signal is defined
      }
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason));
    });

  it("runs once with no signal when no timeout is configured", async () => {
    const llm = new LLM(config, false, false);
    const provider = await getProvider(llm);

    let calls = 0;
    let receivedSignal: AbortSignal | undefined = {} as AbortSignal;
    const result = await provider.withTimeoutRetries((signal: AbortSignal | undefined) => {
      calls++;
      receivedSignal = signal;
      return Promise.resolve("ok");
    });

    expect(result).toBe("ok");
    expect(calls).toBe(1);
    expect(receivedSignal).toBeUndefined();
  });

  it("returns immediately when the operation resolves before the timeout", async () => {
    const llm = new LLM(config, false, false, false, 50, 3);
    const provider = await getProvider(llm);

    let calls = 0;
    let receivedSignal: AbortSignal | undefined;
    const result = await provider.withTimeoutRetries((signal: AbortSignal | undefined) => {
      calls++;
      receivedSignal = signal;
      return Promise.resolve("fast");
    });

    expect(result).toBe("fast");
    expect(calls).toBe(1);
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  it("retries on timeout and then succeeds", async () => {
    const llm = new LLM(config, false, false, false, 20, 3);
    const provider = await getProvider(llm);

    let calls = 0;
    const result = await provider.withTimeoutRetries((signal: AbortSignal | undefined) => {
      calls++;
      if (calls < 3) {
        return hangUntilAbort(signal); // time out the first two attempts
      }
      return Promise.resolve("recovered");
    });

    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("throws a timeout error after exhausting retries", async () => {
    const llm = new LLM(config, false, false, false, 20, 2);
    const provider = await getProvider(llm);

    let calls = 0;
    await expect(
      provider.withTimeoutRetries((signal: AbortSignal | undefined) => {
        calls++;
        return hangUntilAbort(signal);
      })
    ).rejects.toThrow(/timed out after 20ms/);

    expect(calls).toBe(3); // llmTimeoutRetries (2) + 1
  });

  it("propagates non-timeout errors without consuming retries", async () => {
    const llm = new LLM(config, false, false, false, 50, 3);
    const provider = await getProvider(llm);

    let calls = 0;
    await expect(
      provider.withTimeoutRetries(() => {
        calls++;
        return Promise.reject(new Error("boom"));
      })
    ).rejects.toThrow("boom");

    expect(calls).toBe(1);
  });
});
