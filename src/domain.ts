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
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  /** Custom base URL for the API (e.g., for proxies or Azure-compatible endpoints) */
  baseURL?: string;
}

/** Vertex AI configuration for regional Google Cloud deployments */
export interface VertexAIConfig {
  /** Google Cloud project ID */
  project: string;
  /** Google Cloud location (e.g., "us-central1", "europe-west1") */
  location: string;
}

export interface GoogleProviderConfig {
  provider: "google";
  model: string;
  thinkingBudget?: number;
  /** API key for Gemini API. Required when vertexai is not set. */
  apiKey?: string;
  /** Vertex AI config for regional deployments. Uses ADC for authentication. */
  vertexai?: VertexAIConfig;
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

// Event logging input types
export interface LLMCallInput {
  prompt: string;
  response: string;
  model: string;
  durationInMillis: number;
}

export interface APICallInput {
  url: string;
  requestMethod: string;
  responseStatusCode: number;
  durationInMillis: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

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
