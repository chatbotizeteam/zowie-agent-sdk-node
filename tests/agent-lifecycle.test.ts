import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import request from "supertest";
import type { AgentOptions } from "../src/agent";
import { Agent } from "../src/agent";
import type { Context } from "../src/context";
import type { AgentResponse } from "../src/domain";

class TestAgent extends Agent {
  private responseToReturn: AgentResponse = { type: "continue", message: "Test response" };

  setResponse(response: AgentResponse) {
    this.responseToReturn = response;
  }

  async handle(context: Context): Promise<AgentResponse> {
    this.logger.info("Test agent handling request", { requestId: context.metadata.requestId });
    return this.responseToReturn;
  }
}

class ErrorAgent extends Agent {
  async handle(_context: Context): Promise<AgentResponse> {
    throw new Error("Test error");
  }
}

describe("Agent Lifecycle", () => {
  let agent: TestAgent;

  beforeEach(() => {
    const options: AgentOptions = {
      llmConfig: {
        provider: "google",
        apiKey: "test-key",
        model: "gemini-2.5-flash",
      },
    };
    agent = new TestAgent(options);
  });

  afterEach(async () => {
    try {
      await agent.close();
    } catch (_error) {
      // Ignore errors during cleanup
    }
  });

  describe("Agent Construction", () => {
    it("should create agent with minimal config", () => {
      const options: AgentOptions = {
        llmConfig: {
          provider: "google",
          apiKey: "test-key",
          model: "gemini-2.5-flash",
        },
      };
      const testAgent = new TestAgent(options);

      expect(testAgent).toBeDefined();
      expect(testAgent.app).toBeDefined();
    });

    it("should create agent with full config", () => {
      const options: AgentOptions = {
        llmConfig: {
          provider: "openai",
          apiKey: "test-key",
          model: "gpt-5-mini",
        },
        httpTimeoutMs: 5000,
        authConfig: {
          type: "api_key",
          headerName: "X-API-Key",
          apiKey: "test-auth-key",
        },
        includePersonaByDefault: false,
        includeContextByDefault: false,
        includeHttpHeadersByDefault: false,
        includeRequestBodiesInEventsByDefault: false,
        port: 4000,
      };
      const testAgent = new TestAgent(options);

      expect(testAgent).toBeDefined();
      expect(testAgent.app).toBeDefined();
    });
  });

  describe("Server Management", () => {
    it("should start server with listen()", async () => {
      const port = 3001;
      await agent.listen(port);

      const response = await request(agent.app).get("/health");
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        agent: "TestAgent",
        timestamp: expect.any(Number),
      });
    });

    it("should start server with default port", async () => {
      await agent.listen(); // Should use default port 3000

      const response = await request(agent.app).get("/health");
      expect(response.status).toBe(200);
    });

    it("should stop server with close()", async () => {
      await agent.listen(3002);

      // Verify server is running
      const response = await request(agent.app).get("/health");
      expect(response.status).toBe(200);

      // Stop the server
      await agent.close();

      // Note: We can't easily test that the server is actually closed
      // because supertest creates its own server instance
    });
  });

  describe("Health Endpoint", () => {
    it("should return health status", async () => {
      const response = await request(agent.app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        agent: "TestAgent",
        timestamp: expect.any(Number),
      });
    });
  });

  describe("Request Handling", () => {
    const validRequest = {
      metadata: {
        requestId: "test-123",
        chatbotId: "bot-456",
        conversationId: "conv-789",
      },
      messages: [
        {
          author: "User",
          content: "Test message",
          timestamp: new Date().toISOString(),
        },
      ],
    };

    it("should handle valid requests", async () => {
      const response = await request(agent.app).post("/").send(validRequest);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        command: {
          type: "send_message",
          payload: {
            message: "Test response",
          },
        },
      });
    });

    it("should handle continue conversation response", async () => {
      agent.setResponse({ type: "continue", message: "Continue response" });

      const response = await request(agent.app).post("/").send(validRequest);

      expect(response.status).toBe(200);
      expect(response.body.command).toEqual({
        type: "send_message",
        payload: {
          message: "Continue response",
        },
      });
    });

    it("should handle transfer to block response", async () => {
      agent.setResponse({
        type: "finish",
        nextBlock: "next-block-key",
        message: "Transferring...",
      });

      const response = await request(agent.app).post("/").send(validRequest);

      expect(response.status).toBe(200);
      expect(response.body.command).toEqual({
        type: "go_to_next_block",
        payload: {
          nextBlockReferenceKey: "next-block-key",
          message: "Transferring...",
        },
      });
    });

    it("should include stored values in response", async () => {
      // Create an agent that stores values
      class StoringAgent extends Agent {
        async handle(context: Context): Promise<AgentResponse> {
          context.storeValue("testKey", "testValue");
          context.storeValue("timestamp", Date.now());
          return { type: "continue", message: "Values stored" };
        }
      }

      const storingAgent = new StoringAgent({
        llmConfig: {
          provider: "google",
          apiKey: "test-key",
          model: "gemini-2.5-flash",
        },
      });

      const response = await request(storingAgent.app).post("/").send(validRequest);

      expect(response.status).toBe(200);
      expect(response.body.valuesToSave).toEqual({
        testKey: "testValue",
        timestamp: expect.any(Number),
      });
    });

    it("should include events in response", async () => {
      // Create an agent that generates events
      class EventAgent extends Agent {
        async handle(context: Context): Promise<AgentResponse> {
          context.events.push({
            type: "llm_call",
            payload: {
              prompt: "test prompt",
              response: "test response",
              model: "test-model",
              durationInMillis: 100,
            },
          });
          return { type: "continue", message: "Event added" };
        }
      }

      const eventAgent = new EventAgent({
        llmConfig: {
          provider: "google",
          apiKey: "test-key",
          model: "gemini-2.5-flash",
        },
      });

      const response = await request(eventAgent.app).post("/").send(validRequest);

      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0]).toMatchObject({
        type: "llm_call",
        payload: {
          prompt: "test prompt",
          response: "test response",
          model: "test-model",
          durationInMillis: 100,
        },
      });
    });

    it("should reject invalid requests", async () => {
      const invalidRequest = { invalid: "data" };

      const response = await request(agent.app).post("/").send(invalidRequest);

      expect(response.status).toBe(400);
    });

    it("should handle agent errors gracefully", async () => {
      const errorAgent = new ErrorAgent({
        llmConfig: {
          provider: "google",
          apiKey: "test-key",
          model: "gemini-2.5-flash",
        },
      });

      const response = await request(errorAgent.app).post("/").send(validRequest);

      expect(response.status).toBe(500);
    });
  });

  describe("Authentication", () => {
    it("should accept requests without auth when no auth config", async () => {
      const validRequest = {
        metadata: {
          requestId: "test-123",
          chatbotId: "bot-456",
          conversationId: "conv-789",
        },
        messages: [
          {
            author: "User",
            content: "Test",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const response = await request(agent.app).post("/").send(validRequest);

      expect(response.status).toBe(200);
    });

    it("should require auth when auth config is provided", async () => {
      const authAgent = new TestAgent({
        llmConfig: {
          provider: "google",
          apiKey: "test-key",
          model: "gemini-2.5-flash",
        },
        authConfig: {
          type: "api_key",
          headerName: "X-API-Key",
          apiKey: "secret-key",
        },
      });

      const validRequest = {
        metadata: {
          requestId: "test-123",
          chatbotId: "bot-456",
          conversationId: "conv-789",
        },
        messages: [
          {
            author: "User",
            content: "Test",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // Request without auth header should fail
      const unauthorizedResponse = await request(authAgent.app).post("/").send(validRequest);

      expect(unauthorizedResponse.status).toBe(401);

      // Request with correct auth header should succeed
      const authorizedResponse = await request(authAgent.app)
        .post("/")
        .set("X-API-Key", "secret-key")
        .send(validRequest);

      expect(authorizedResponse.status).toBe(200);
    });
  });
});
