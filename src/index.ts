/**
 * Zowie Agent SDK for Node.js/TypeScript
 *
 * A TypeScript framework for building external agents that integrate with Zowie Decision Engine.
 */

// Core classes
export { Agent, type AgentOptions } from "./agent.js";
export { Context } from "./context.js";

// Configuration types
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
// HTTP client options
export type { HTTPRequestOptions } from "./http.js";
// Protocol types (for user code)
export type { Message, Metadata, Persona } from "./protocol.js";
