/**
 * Protocol types and validation tests
 */

import {
  type ExternalAgentResponse,
  ExternalAgentResponseSchema,
  filterMessages,
  type Message,
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
        sequence: 2,
      };

      const result = MetadataSchema.parse(validMetadata);
      expect(result).toEqual(validMetadata);
    });

    test("should require mandatory fields", () => {
      const invalidMetadata = {
        requestId: "req-123",
        // Missing chatbotId, conversationId, and sequence
      };

      expect(() => MetadataSchema.parse(invalidMetadata)).toThrow();
    });

    test("should require sequence", () => {
      const missingSequence = {
        requestId: "req-123",
        chatbotId: "bot-456",
        conversationId: "conv-789",
      };

      expect(() => MetadataSchema.parse(missingSequence)).toThrow();
    });

    test("should expose sequence on parsed metadata", () => {
      const metadata = {
        requestId: "req-123",
        chatbotId: "bot-456",
        conversationId: "conv-789",
        sequence: 7,
      };

      const result = MetadataSchema.parse(metadata);
      expect(result.sequence).toBe(7);
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

    test("should validate chatbot message with skipped, interrupted, and cancelled flags", () => {
      const chatbotMessage = {
        author: "Chatbot" as const,
        content: "Partial reply",
        timestamp: "2024-01-01T12:00:00Z",
        skipped: true,
        interrupted: false,
        cancelled: true,
      };

      const result = MessageSchema.parse(chatbotMessage);
      expect(result).toEqual(chatbotMessage);
    });

    test("should leave skipped/interrupted/cancelled undefined when omitted", () => {
      const userMessage = {
        author: "User" as const,
        content: "Hi",
        timestamp: "2024-01-01T12:00:00Z",
      };

      const result = MessageSchema.parse(userMessage);
      expect(result.skipped).toBeUndefined();
      expect(result.interrupted).toBeUndefined();
      expect(result.cancelled).toBeUndefined();
    });
  });

  describe("filterMessages", () => {
    const ts = "2024-01-01T12:00:00Z";
    const user: Message = { author: "User", content: "u", timestamp: ts };
    const chatbot: Message = { author: "Chatbot", content: "c", timestamp: ts };
    const skipped: Message = { author: "Chatbot", content: "s", timestamp: ts, skipped: true };
    const interrupted: Message = {
      author: "Chatbot",
      content: "i",
      timestamp: ts,
      interrupted: true,
    };
    const cancelled: Message = { author: "Chatbot", content: "x", timestamp: ts, cancelled: true };
    const both: Message = {
      author: "Chatbot",
      content: "b",
      timestamp: ts,
      skipped: true,
      interrupted: true,
    };

    test("excludes skipped, interrupted, and cancelled by default", () => {
      const result = filterMessages(
        [user, chatbot, skipped, interrupted, cancelled, both],
        false,
        false,
        false
      );
      expect(result).toEqual([user, chatbot]);
    });

    test("keeps skipped when opted in", () => {
      const result = filterMessages([user, skipped, interrupted, cancelled], true, false, false);
      expect(result).toEqual([user, skipped]);
    });

    test("keeps interrupted when opted in", () => {
      const result = filterMessages([user, skipped, interrupted, cancelled], false, true, false);
      expect(result).toEqual([user, interrupted]);
    });

    test("keeps cancelled when opted in", () => {
      const result = filterMessages([user, skipped, interrupted, cancelled], false, false, true);
      expect(result).toEqual([user, cancelled]);
    });

    test("requires both flags to keep a message that is both skipped and interrupted", () => {
      expect(filterMessages([both], true, false, false)).toEqual([]);
      expect(filterMessages([both], false, true, false)).toEqual([]);
      expect(filterMessages([both], true, true, false)).toEqual([both]);
    });

    test("leaves plain user and chatbot messages untouched", () => {
      const result = filterMessages([user, chatbot], false, false, false);
      expect(result).toEqual([user, chatbot]);
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
          sequence: 1,
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
          sequence: 1,
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
