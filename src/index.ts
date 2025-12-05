/**
 * Zowie Agent SDK for Node.js/TypeScript
 *
 * A TypeScript framework for building external agents that integrate with Zowie Decision Engine.
 */

// Core classes
export { Agent, type AgentOptions, type HandleRequestOptions } from "./agent.js";
export { Context } from "./context.js";

// Configuration types
export type {
  AgentResponse,
  APICallInput,
  APIKeyAuth,
  AuthConfig,
  BasicAuth,
  BearerTokenAuth,
  ContinueConversationResponse,
  GoogleProviderConfig,
  LLMCallInput,
  LLMConfig,
  OpenAIProviderConfig,
  TransferToBlockResponse,
  VertexAIConfig,
} from "./domain.js";
// HTTP client options
export type { HTTPRequestOptions } from "./http.js";
// Protocol types (for user code)
export type { ExternalAgentResponse, Message, Metadata, Persona } from "./protocol.js";
