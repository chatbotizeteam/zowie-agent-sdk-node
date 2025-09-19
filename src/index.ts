/**
 * Zowie Agent SDK for Node.js/TypeScript
 *
 * A TypeScript framework for building external agents that integrate with Zowie Decision Engine.
 */

// Main classes
export { Agent, type AgentOptions } from "./agent.js";
export { AuthError, AuthValidator } from "./auth.js";
export { Context, ContextualHTTPClient, ContextualLLM } from "./context.js";
// Domain types (internal)
export type {
  AgentResponse,
  APIKeyAuth,
  AuthConfig,
  BasicAuth,
  BearerTokenAuth,
  ContinueConversationResponse,
  GoogleProviderConfig,
  LLMConfig,
  OpenAIProviderConfig,
  TransferToBlockResponse,
} from "./domain.js";
export { createAPIKeyAuth, createBasicAuth, createBearerTokenAuth } from "./domain.js";
export { HTTPClient, type HTTPRequestOptions } from "./http.js";
// LLM providers
export { BaseLLMProvider, LLM } from "./llm/index.js";
// Logging
export { getLogger } from "./logger.js";
// Protocol types (external API)
export type {
  APICallEvent,
  Command,
  Event,
  ExternalAgentResponse,
  GoToNextBlockCommand,
  IncomingRequest,
  LLMCallEvent,
  Message,
  Metadata,
  Persona,
  SendMessageCommand,
} from "./protocol.js";
export {
  APICallEventSchema,
  CommandSchema,
  EventSchema,
  ExternalAgentResponseSchema,
  GoToNextBlockCommandSchema,
  IncomingRequestSchema,
  LLMCallEventSchema,
  MessageSchema,
  MetadataSchema,
  PersonaSchema,
  parseIncomingRequest,
  SendMessageCommandSchema,
  serializeExternalAgentResponse,
} from "./protocol.js";
// Utilities
export { getTimeMs, isAbortError, isTimeoutError } from "./utils.js";

// Package version
export const VERSION = "0.1.0";
