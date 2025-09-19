/**
 * HTTP API Protocol types matching the SPEC.md definition.
 *
 * These types define the external contract for the Zowie Agent SDK API.
 * They handle automatic camelCase serialization for JSON communication.
 */

import { z } from "zod";

// Request types

export const MetadataSchema = z.object({
  requestId: z.string(),
  chatbotId: z.string(),
  conversationId: z.string(),
  interactionId: z.string().optional(),
});

export type Metadata = z.infer<typeof MetadataSchema>;

export const MessageSchema = z.object({
  author: z.enum(["User", "Chatbot"]),
  content: z.string(),
  timestamp: z.string().datetime(),
});

export type Message = z.infer<typeof MessageSchema>;

export const PersonaSchema = z.object({
  name: z.string().optional(),
  businessContext: z.string().optional(),
  toneOfVoice: z.string().optional(),
});

export type Persona = z.infer<typeof PersonaSchema>;

// Response command types

export const SendMessagePayloadSchema = z.object({
  message: z.string(),
});

export type SendMessagePayload = z.infer<typeof SendMessagePayloadSchema>;

export const SendMessageCommandSchema = z.object({
  type: z.literal("send_message"),
  payload: SendMessagePayloadSchema,
});

export type SendMessageCommand = z.infer<typeof SendMessageCommandSchema>;

export const GoToNextBlockPayloadSchema = z.object({
  message: z.string().optional(),
  nextBlockReferenceKey: z.string(),
});

export type GoToNextBlockPayload = z.infer<typeof GoToNextBlockPayloadSchema>;

export const GoToNextBlockCommandSchema = z.object({
  type: z.literal("go_to_next_block"),
  payload: GoToNextBlockPayloadSchema,
});

export type GoToNextBlockCommand = z.infer<typeof GoToNextBlockCommandSchema>;

export const CommandSchema = z.discriminatedUnion("type", [
  SendMessageCommandSchema,
  GoToNextBlockCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;

// Event types

export const LLMCallEventPayloadSchema = z.object({
  prompt: z.string(),
  response: z.string(),
  model: z.string(),
  durationInMillis: z.number(),
});

export type LLMCallEventPayload = z.infer<typeof LLMCallEventPayloadSchema>;

export const LLMCallEventSchema = z.object({
  type: z.literal("llm_call"),
  payload: LLMCallEventPayloadSchema,
});

export type LLMCallEvent = z.infer<typeof LLMCallEventSchema>;

export const APICallEventPayloadSchema = z.object({
  url: z.string(),
  requestHeaders: z.record(z.string()),
  requestMethod: z.string(),
  requestBody: z.string().optional(),
  responseHeaders: z.record(z.string()),
  responseStatusCode: z.number(),
  responseBody: z.string().optional(),
  durationInMillis: z.number(),
});

export type APICallEventPayload = z.infer<typeof APICallEventPayloadSchema>;

export const APICallEventSchema = z.object({
  type: z.literal("api_call"),
  payload: APICallEventPayloadSchema,
});

export type APICallEvent = z.infer<typeof APICallEventSchema>;

export const EventSchema = z.discriminatedUnion("type", [LLMCallEventSchema, APICallEventSchema]);

export type Event = z.infer<typeof EventSchema>;

// Incoming request validation
export const IncomingRequestSchema = z.object({
  metadata: MetadataSchema,
  messages: z.array(MessageSchema),
  context: z.string().optional().nullable(),
  persona: PersonaSchema.optional().nullable(),
});

export type IncomingRequest = z.infer<typeof IncomingRequestSchema>;

// Main response type
export const ExternalAgentResponseSchema = z.object({
  command: CommandSchema,
  valuesToSave: z.record(z.unknown()).optional(),
  events: z.array(EventSchema).optional(),
});

export type ExternalAgentResponse = z.infer<typeof ExternalAgentResponseSchema>;

/**
 * Validates and parses an incoming request
 */
export function parseIncomingRequest(data: unknown): IncomingRequest {
  return IncomingRequestSchema.parse(data);
}

/**
 * Validates and serializes an outgoing response
 */
export function serializeExternalAgentResponse(response: ExternalAgentResponse): unknown {
  return ExternalAgentResponseSchema.parse(response);
}
