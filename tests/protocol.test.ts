/**
 * Protocol types and validation tests
 */

import {
  type ExternalAgentResponse,
  ExternalAgentResponseSchema,
  MessageSchema,
  MetadataSchema,
  PersonaSchema,
  parseIncomingRequest,
  serializeExternalAgentResponse,
} from "../src/protocol.js";

describe("Protocol Validation", () => {
  describe("Metadata Schema", () => {
    test("should validate valid metadata", () => {
      const validMetadata = {
        requestId: "req-123",
        chatbotId: "bot-456",
        conversationId: "conv-789",
        interactionId: "int-000",
      };

      const result = MetadataSchema.parse(validMetadata);
      expect(result).toEqual(validMetadata);
    });

    test("should require mandatory fields", () => {
      const invalidMetadata = {
        requestId: "req-123",
        // Missing chatbotId and conversationId
      };

      expect(() => MetadataSchema.parse(invalidMetadata)).toThrow();
    });
  });

  describe("Message Schema", () => {
    test("should validate valid message", () => {
      const validMessage = {
        author: "User" as const,
        content: "Hello world",
        timestamp: "2024-01-01T12:00:00Z",
      };

      const result = MessageSchema.parse(validMessage);
      expect(result).toEqual(validMessage);
    });

    test("should reject invalid author", () => {
      const invalidMessage = {
        author: "InvalidAuthor",
        content: "Hello",
        timestamp: "2024-01-01T12:00:00Z",
      };

      expect(() => MessageSchema.parse(invalidMessage)).toThrow();
    });
  });

  describe("Persona Schema", () => {
    test("should validate persona with all fields", () => {
      const validPersona = {
        name: "Assistant",
        businessContext: "Customer support",
        toneOfVoice: "Friendly and professional",
      };

      const result = PersonaSchema.parse(validPersona);
      expect(result.name).toBe("Assistant");
    });

    test("should allow empty persona", () => {
      const emptyPersona = {};
      const result = PersonaSchema.parse(emptyPersona);
      expect(result).toEqual({});
    });
  });

  describe("Incoming Request", () => {
    test("should parse valid incoming request", () => {
      const validRequest = {
        metadata: {
          requestId: "req-123",
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
        context: "Some context",
        persona: {
          name: "Assistant",
        },
      };

      const result = parseIncomingRequest(validRequest);
      expect(result.metadata.requestId).toBe("req-123");
      expect(result.messages).toHaveLength(1);
    });

    test("should handle minimal request", () => {
      const minimalRequest = {
        metadata: {
          requestId: "req-123",
          chatbotId: "bot-456",
          conversationId: "conv-789",
        },
        messages: [],
      };

      const result = parseIncomingRequest(minimalRequest);
      expect(result.messages).toHaveLength(0);
      expect(result.context).toBeUndefined();
      expect(result.persona).toBeUndefined();
    });
  });

  describe("External Agent Response", () => {
    test("should serialize continue conversation response", () => {
      const response: ExternalAgentResponse = {
        command: {
          type: "send_message",
          payload: {
            message: "Hello back!",
          },
        },
        valuesToSave: {
          key: "value",
        },
        events: [
          {
            type: "llm_call",
            payload: {
              prompt: "Test prompt",
              response: "Test response",
              model: "test-model",
              durationInMillis: 100,
            },
          },
        ],
      };

      const result = serializeExternalAgentResponse(response);
      expect(result).toBeDefined();
    });

    test("should serialize transfer response", () => {
      const response: ExternalAgentResponse = {
        command: {
          type: "go_to_next_block",
          payload: {
            nextBlockReferenceKey: "support",
            message: "Transferring...",
          },
        },
      };

      const result = serializeExternalAgentResponse(response);
      expect(result).toBeDefined();
    });

    test("should validate response structure", () => {
      const validResponse = {
        command: {
          type: "send_message",
          payload: {
            message: "Response",
          },
        },
      };

      const result = ExternalAgentResponseSchema.parse(validResponse);
      expect(result.command.type).toBe("send_message");
    });
  });
});
