import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import type { AgentOptions } from "../src/agent";
import { Agent } from "../src/agent";
import type { Context } from "../src/context";
import type { AgentResponse } from "../src/domain";

class StorageTestAgent extends Agent {
  async handle(context: Context): Promise<AgentResponse> {
    // Store various types of values
    context.storeValue("stringValue", "hello world");
    context.storeValue("numberValue", 42);
    context.storeValue("booleanValue", true);
    context.storeValue("objectValue", {
      nested: "value",
      count: 10,
      active: false,
    });
    context.storeValue("arrayValue", [1, 2, "three", { four: 4 }]);
    context.storeValue("nullValue", null);
    context.storeValue("undefinedValue", undefined);

    return {
      type: "continue",
      message: "Values stored successfully",
    };
  }
}

class ConditionalStorageAgent extends Agent {
  async handle(context: Context): Promise<AgentResponse> {
    const userMessage = context.messages[context.messages.length - 1]?.content || "";

    if (userMessage.includes("store")) {
      context.storeValue("conditionalKey", "stored because message contained 'store'");
      context.storeValue("timestamp", new Date().toISOString());
    }

    if (userMessage.includes("premium")) {
      context.storeValue("userTier", "premium");
      context.storeValue("discountApplied", 0.15);
    }

    return {
      type: "continue",
      message: "Processing completed",
    };
  }
}

class EmptyStorageAgent extends Agent {
  async handle(_context: Context): Promise<AgentResponse> {
    // This agent doesn't store any values
    return {
      type: "continue",
      message: "No values stored",
    };
  }
}

describe("Value Storage", () => {
  const baseRequest = {
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

  const agentOptions: AgentOptions = {
    llmConfig: {
      provider: "google",
      apiKey: "test-key",
      model: "gemini-2.5-flash",
    },
  };

  describe("Basic Value Storage", () => {
    let agent: StorageTestAgent;

    beforeEach(() => {
      agent = new StorageTestAgent(agentOptions);
    });

    it("should include stored values in response", async () => {
      const response = await request(agent.app).post("/").send(baseRequest);

      expect(response.status).toBe(200);
      expect(response.body.valuesToSave).toBeDefined();
      expect(response.body.valuesToSave).toEqual({
        stringValue: "hello world",
        numberValue: 42,
        booleanValue: true,
        objectValue: {
          nested: "value",
          count: 10,
          active: false,
        },
        arrayValue: [1, 2, "three", { four: 4 }],
        nullValue: null,
        undefinedValue: undefined,
      });
    });

    it("should store different types of values correctly", async () => {
      const response = await request(agent.app).post("/").send(baseRequest);

      const values = response.body.valuesToSave;

      expect(typeof values.stringValue).toBe("string");
      expect(typeof values.numberValue).toBe("number");
      expect(typeof values.booleanValue).toBe("boolean");
      expect(typeof values.objectValue).toBe("object");
      expect(Array.isArray(values.arrayValue)).toBe(true);
      expect(values.nullValue).toBeNull();
      expect(values.undefinedValue).toBeUndefined();
    });
  });

  describe("Conditional Value Storage", () => {
    let agent: ConditionalStorageAgent;

    beforeEach(() => {
      agent = new ConditionalStorageAgent(agentOptions);
    });

    it("should store values based on message content", async () => {
      const requestWithStore = {
        ...baseRequest,
        messages: [
          {
            author: "User",
            content: "Please store my preferences",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const response = await request(agent.app).post("/").send(requestWithStore);

      expect(response.status).toBe(200);
      expect(response.body.valuesToSave).toEqual({
        conditionalKey: "stored because message contained 'store'",
        timestamp: expect.any(String),
      });
    });

    it("should store premium user values", async () => {
      const premiumRequest = {
        ...baseRequest,
        messages: [
          {
            author: "User",
            content: "I'm a premium user, store my data",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const response = await request(agent.app).post("/").send(premiumRequest);

      expect(response.status).toBe(200);
      expect(response.body.valuesToSave).toEqual({
        conditionalKey: "stored because message contained 'store'",
        timestamp: expect.any(String),
        userTier: "premium",
        discountApplied: 0.15,
      });
    });

    it("should not store values when conditions not met", async () => {
      const regularRequest = {
        ...baseRequest,
        messages: [
          {
            author: "User",
            content: "Just a regular message",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const response = await request(agent.app).post("/").send(regularRequest);

      expect(response.status).toBe(200);
      expect(response.body.valuesToSave).toBeUndefined();
    });
  });

  describe("Empty Value Storage", () => {
    let agent: EmptyStorageAgent;

    beforeEach(() => {
      agent = new EmptyStorageAgent(agentOptions);
    });

    it("should not include valuesToSave when no values stored", async () => {
      const response = await request(agent.app).post("/").send(baseRequest);

      expect(response.status).toBe(200);
      expect(response.body.valuesToSave).toBeUndefined();
    });
  });

  describe("Value Storage Edge Cases", () => {
    class EdgeCaseAgent extends Agent {
      async handle(context: Context): Promise<AgentResponse> {
        const message = context.messages[context.messages.length - 1]?.content || "";

        switch (message) {
          case "empty-string":
            context.storeValue("emptyString", "");
            break;
          case "zero":
            context.storeValue("zeroValue", 0);
            break;
          case "false":
            context.storeValue("falseValue", false);
            break;
          case "empty-object":
            context.storeValue("emptyObject", {});
            break;
          case "empty-array":
            context.storeValue("emptyArray", []);
            break;
          case "overwrite":
            context.storeValue("key", "first");
            context.storeValue("key", "second");
            break;
        }

        return { type: "continue", message: "Edge case handled" };
      }
    }

    let agent: EdgeCaseAgent;

    beforeEach(() => {
      agent = new EdgeCaseAgent(agentOptions);
    });

    it("should handle empty string values", async () => {
      const response = await request(agent.app)
        .post("/")
        .send({
          ...baseRequest,
          messages: [
            { author: "User", content: "empty-string", timestamp: new Date().toISOString() },
          ],
        });

      expect(response.body.valuesToSave).toEqual({ emptyString: "" });
    });

    it("should handle zero values", async () => {
      const response = await request(agent.app)
        .post("/")
        .send({
          ...baseRequest,
          messages: [{ author: "User", content: "zero", timestamp: new Date().toISOString() }],
        });

      expect(response.body.valuesToSave).toEqual({ zeroValue: 0 });
    });

    it("should handle false values", async () => {
      const response = await request(agent.app)
        .post("/")
        .send({
          ...baseRequest,
          messages: [{ author: "User", content: "false", timestamp: new Date().toISOString() }],
        });

      expect(response.body.valuesToSave).toEqual({ falseValue: false });
    });

    it("should handle empty objects", async () => {
      const response = await request(agent.app)
        .post("/")
        .send({
          ...baseRequest,
          messages: [
            { author: "User", content: "empty-object", timestamp: new Date().toISOString() },
          ],
        });

      expect(response.body.valuesToSave).toEqual({ emptyObject: {} });
    });

    it("should handle empty arrays", async () => {
      const response = await request(agent.app)
        .post("/")
        .send({
          ...baseRequest,
          messages: [
            { author: "User", content: "empty-array", timestamp: new Date().toISOString() },
          ],
        });

      expect(response.body.valuesToSave).toEqual({ emptyArray: [] });
    });

    it("should handle value overwriting", async () => {
      const response = await request(agent.app)
        .post("/")
        .send({
          ...baseRequest,
          messages: [{ author: "User", content: "overwrite", timestamp: new Date().toISOString() }],
        });

      expect(response.body.valuesToSave).toEqual({ key: "second" });
    });
  });

  describe("Value Storage with Transfer Response", () => {
    class TransferAgent extends Agent {
      async handle(context: Context): Promise<AgentResponse> {
        context.storeValue("transferReason", "escalating to human");
        context.storeValue("transferTime", new Date().toISOString());

        return {
          type: "finish",
          nextBlock: "human-handoff-block",
          message: "Transferring to human agent",
        };
      }
    }

    it("should include stored values with transfer responses", async () => {
      const agent = new TransferAgent(agentOptions);

      const response = await request(agent.app).post("/").send(baseRequest);

      expect(response.status).toBe(200);
      expect(response.body.command.type).toBe("go_to_next_block");
      expect(response.body.valuesToSave).toEqual({
        transferReason: "escalating to human",
        transferTime: expect.any(String),
      });
    });
  });
});
