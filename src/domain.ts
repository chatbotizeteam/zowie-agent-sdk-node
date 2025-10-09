/**
 * Internal SDK domain types.
 *
 * These types are used internally by the SDK for configuration,
 * processing, and agent implementation. They are not part of the
 * external API contract.
 */

// Agent response types (internal)
export interface ContinueConversationResponse {
  type: "continue";
  message: string;
}

export interface TransferToBlockResponse {
  type: "finish";
  message?: string;
  nextBlock: string;
}

export type AgentResponse = ContinueConversationResponse | TransferToBlockResponse;

// LLM provider configuration
export interface OpenAIProviderConfig {
  provider: "openai";
  apiKey: string;
  model: string;
  reasoningEffort?: "low" | "medium" | "high";
}

export interface GoogleProviderConfig {
  provider: "google";
  apiKey: string;
  model: string;
  thinkingBudget?: number;
}

export type LLMConfig = OpenAIProviderConfig | GoogleProviderConfig;

// Authentication configuration
export interface APIKeyAuth {
  type: "api_key";
  headerName: string;
  apiKey: string;
}

export interface BasicAuth {
  type: "basic";
  username: string;
  password: string;
}

export interface BearerTokenAuth {
  type: "bearer";
  token: string;
}

export type AuthConfig = APIKeyAuth | BasicAuth | BearerTokenAuth;

// Auth config creation helpers
export function createAPIKeyAuth(headerName: string, apiKey: string): APIKeyAuth {
  return { type: "api_key", headerName, apiKey };
}

export function createBasicAuth(username: string, password: string): BasicAuth {
  return { type: "basic", username, password };
}

export function createBearerTokenAuth(token: string): BearerTokenAuth {
  return { type: "bearer", token };
}
