/**
 * Basic functionality tests for the SDK
 */

import {
  Agent,
  type AgentResponse,
  type Context,
  HTTPClient,
  parseIncomingRequest,
  serializeExternalAgentResponse,
} from "../src/index.js";

// Simple test agent
class TestAgent extends Agent {
  async handle(_context: Context): Promise<AgentResponse> {
    return { type: "continue", message: "Test response" };
  }
}

describe("Basic SDK Functionality", () => {
  test("should create agent with Google config", () => {
    const agent = new TestAgent({
      llmConfig: { provider: "google", apiKey: "test-key", model: "gemini-2.5-flash" },
    });
    expect(agent).toBeDefined();
    expect(agent.app).toBeDefined();
  });

  test("should create agent with OpenAI config", () => {
    const agent = new TestAgent({
      llmConfig: { provider: "openai", apiKey: "test-key", model: "gpt-5-mini" },
    });
    expect(agent).toBeDefined();
  });

  test("should create auth configs", () => {
    const apiKeyAuth = { type: "api_key", headerName: "X-API-Key", apiKey: "secret" };
    expect(apiKeyAuth.type).toBe("api_key");
    expect(apiKeyAuth.headerName).toBe("X-API-Key");

    const basicAuth = { type: "basic", username: "user", password: "pass" };
    expect(basicAuth.type).toBe("basic");

    const bearerAuth = { type: "bearer", token: "token" };
    expect(bearerAuth.type).toBe("bearer");
  });

  test("should create HTTP client", () => {
    const client = new HTTPClient();
    expect(client).toBeDefined();
    expect(typeof client.get).toBe("function");
    expect(typeof client.post).toBe("function");
  });

  test("should parse incoming request", () => {
    const request = {
      metadata: {
        requestId: "test-123",
        chatbotId: "bot-456",
        conversationId: "conv-789",
      },
      messages: [
        {
          author: "User",
          content: "Hello",
          timestamp: "2024-01-01T12:00:00Z",
        },
      ],
    };

    const parsed = parseIncomingRequest(request);
    expect(parsed.metadata.requestId).toBe("test-123");
    expect(parsed.messages).toHaveLength(1);
  });

  test("should serialize agent response", () => {
    const response = {
      command: {
        type: "send_message" as const,
        payload: {
          message: "Test response",
        },
      },
    };

    const serialized = serializeExternalAgentResponse(response);
    expect(serialized).toBeDefined();
  });
});
